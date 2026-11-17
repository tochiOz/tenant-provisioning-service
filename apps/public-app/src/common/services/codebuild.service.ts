import {
  CodeBuildClient,
  CreateProjectCommand,
  CreateProjectCommandInput,
  UpdateProjectCommand,
  ListProjectsCommand,
  ArtifactsType,
  ComputeType,
  EnvironmentType,
  EnvironmentVariableType,
  SourceType,
} from "@aws-sdk/client-codebuild";
import { fromEnv } from "@aws-sdk/credential-providers";
import { logAsync, Logger } from "../logger";
import { errorMessage } from "../utils";

/** Manages the per-tenant CodeBuild project that deploys the tenant's stacks. */
export class CodeBuildService {
  private readonly client: CodeBuildClient;
  private readonly stage: string;
  private readonly region: string;
  private readonly accountId: string;
  private readonly serviceRoleArn: string;

  constructor() {
    this.region = process.env["AWS_REGION"] || "ca-central-1";
    this.stage = process.env["STAGE"] || "dev";
    this.accountId = process.env["ACCOUNT_ID"] || "";
    this.client = new CodeBuildClient({ region: this.region, credentials: fromEnv() });
    this.serviceRoleArn = `arn:aws:iam::${this.accountId}:role/${this.stage}-codebuild-service-role`;
  }

  getProjectName(tenantId: string, platform: string): string {
    return `${this.stage}-tenant-${tenantId}-${platform}`;
  }

  @logAsync("info")
  async projectExists(projectName: string): Promise<boolean> {
    try {
      const response = await this.client.send(new ListProjectsCommand({}));
      return response.projects?.includes(projectName) || false;
    } catch (error) {
      Logger.error(`Error checking if CodeBuild project exists: ${errorMessage(error)}`);
      return false;
    }
  }

  @logAsync("info")
  async createOrUpdateProject(tenantId: string, platform: string) {
    const projectName = this.getProjectName(tenantId, platform);

    const project: CreateProjectCommandInput = {
      name: projectName,
      description: `CodeBuild project for tenant ${tenantId} (${platform})`,
      // Source and artifacts come from the tenant's CodePipeline
      source: { type: SourceType.CODEPIPELINE },
      artifacts: { type: ArtifactsType.CODEPIPELINE },
      environment: {
        type: EnvironmentType.LINUX_CONTAINER,
        computeType: ComputeType.BUILD_GENERAL1_SMALL,
        image: "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
        environmentVariables: [
          { name: "STAGE", value: this.stage, type: EnvironmentVariableType.PLAINTEXT },
          { name: "TENANT_ID", value: tenantId, type: EnvironmentVariableType.PLAINTEXT },
          { name: "AWS_REGION", value: this.region, type: EnvironmentVariableType.PLAINTEXT },
          { name: "ACCOUNT_ID", value: this.accountId, type: EnvironmentVariableType.PLAINTEXT },
          { name: "PLATFORM", value: platform, type: EnvironmentVariableType.PLAINTEXT },
        ],
      },
      serviceRole: this.serviceRoleArn,
      tags: [
        { key: "Service", value: "tenant-provisioning" },
        { key: "Stage", value: this.stage },
        { key: "TenantId", value: tenantId },
        { key: "Platform", value: platform },
      ],
      timeoutInMinutes: 30,
      queuedTimeoutInMinutes: 60,
    };

    try {
      if (await this.projectExists(projectName)) {
        const result = await this.client.send(new UpdateProjectCommand(project));
        Logger.info(`CodeBuild project updated: ${projectName}`);
        return { status: "updated", projectName, projectArn: result.project?.arn };
      }

      const result = await this.client.send(new CreateProjectCommand(project));
      Logger.info(`CodeBuild project created: ${projectName}`);
      return { status: "created", projectName, projectArn: result.project?.arn };
    } catch (error) {
      Logger.error(`Error in createOrUpdateProject: ${errorMessage(error)}`);
      throw error;
    }
  }
}
