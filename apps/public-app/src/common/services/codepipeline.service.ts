import {
  CodePipelineClient,
  CreatePipelineCommand,
  UpdatePipelineCommand,
  StartPipelineExecutionCommand,
  ListPipelinesCommand,
  PipelineDeclaration,
  ActionCategory,
  ActionOwner,
} from "@aws-sdk/client-codepipeline";
import { fromEnv } from "@aws-sdk/credential-providers";
import { logAsync, Logger } from "../logger";
import { errorMessage, extractRepoName } from "../utils";
import { CodeBuildService } from "./codebuild.service";

const PLATFORM = "backend";

/**
 * Manages the per-tenant CodePipeline:
 *   Source (this repository, via a CodeStar connection) -> Build (the tenant's CodeBuild project,
 *   which runs buildspec.yml and deploys the tenant's stacks).
 */
export class CodePipelineService {
  private readonly client: CodePipelineClient;
  private readonly codeBuildService: CodeBuildService;
  private readonly serviceRoleArn: string;
  private readonly artifactBucketName: string;
  private readonly stage: string;

  constructor() {
    const region = process.env["AWS_REGION"] || "ca-central-1";
    const accountId = process.env["ACCOUNT_ID"] || "";
    this.stage = process.env["STAGE"] || "dev";

    this.client = new CodePipelineClient({ region, credentials: fromEnv() });
    this.codeBuildService = new CodeBuildService();
    this.serviceRoleArn = `arn:aws:iam::${accountId}:role/${this.stage}-codepipeline-service-role`;
    this.artifactBucketName = `s3-${this.stage}-${region}.${accountId}.pipeline-artifacts`;
  }

  private getPipelineName(tenantId: string): string {
    return `${this.stage}-tenant-${tenantId}-pipeline`;
  }

  @logAsync("info")
  async pipelineExists(pipelineName: string): Promise<boolean> {
    try {
      const response = await this.client.send(new ListPipelinesCommand({}));
      return response.pipelines?.some((pipeline) => pipeline.name === pipelineName) || false;
    } catch (error) {
      Logger.error(`Error checking if CodePipeline exists: ${errorMessage(error)}`);
      return false;
    }
  }

  @logAsync("info")
  async createOrUpdatePipeline(tenantId: string) {
    const pipelineName = this.getPipelineName(tenantId);

    try {
      if (!process.env["BACKEND_REPO_URL"]) {
        throw new Error("BACKEND_REPO_URL is not set");
      }

      await this.codeBuildService.createOrUpdateProject(tenantId, PLATFORM);
      const config = this.getPipelineConfig(tenantId, pipelineName);

      if (await this.pipelineExists(pipelineName)) {
        await this.client.send(new UpdatePipelineCommand(config));
        Logger.info(`CodePipeline updated: ${pipelineName}`);
      } else {
        await this.client.send(new CreatePipelineCommand(config));
        Logger.info(`CodePipeline created: ${pipelineName}`);
      }

      return { status: "updated", pipelineName };
    } catch (error) {
      Logger.error(`Error in createOrUpdatePipeline: ${errorMessage(error)}`);
      throw error;
    }
  }

  private getPipelineConfig(tenantId: string, pipelineName: string): { pipeline: PipelineDeclaration } {
    return {
      pipeline: {
        name: pipelineName,
        roleArn: this.serviceRoleArn,
        artifactStore: { type: "S3", location: this.artifactBucketName },
        stages: [
          {
            name: "Source",
            actions: [
              {
                name: "Source",
                actionTypeId: {
                  category: ActionCategory.Source,
                  owner: ActionOwner.AWS,
                  provider: "CodeStarSourceConnection",
                  version: "1",
                },
                configuration: {
                  ConnectionArn: process.env["GITHUB_CONNECTION_ARN"] || "",
                  FullRepositoryId: extractRepoName(process.env["BACKEND_REPO_URL"] || ""),
                  BranchName: process.env["GITHUB_BRANCH_NAME"] || "main",
                  OutputArtifactFormat: "CODE_ZIP",
                },
                outputArtifacts: [{ name: "SourceCode" }],
                runOrder: 1,
              },
            ],
          },
          {
            name: "Deploy-Tenant",
            actions: [
              {
                name: "DeployTenant",
                actionTypeId: {
                  category: ActionCategory.Build,
                  owner: ActionOwner.AWS,
                  provider: "CodeBuild",
                  version: "1",
                },
                configuration: {
                  ProjectName: this.codeBuildService.getProjectName(tenantId, PLATFORM),
                },
                inputArtifacts: [{ name: "SourceCode" }],
                outputArtifacts: [{ name: "BuildOutput" }],
                runOrder: 1,
              },
            ],
          },
        ],
      },
    };
  }

  @logAsync("info")
  async startPipeline(tenantId: string): Promise<string> {
    const pipelineName = this.getPipelineName(tenantId);

    try {
      const response = await this.client.send(new StartPipelineExecutionCommand({ name: pipelineName }));
      const executionId = response.pipelineExecutionId || "";
      Logger.info(`Started pipeline ${pipelineName}, execution ID: ${executionId}`);
      return executionId;
    } catch (error) {
      Logger.error(`Failed to start pipeline for tenant ${tenantId}: ${errorMessage(error)}`);
      throw error;
    }
  }
}
