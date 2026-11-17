const stage = process.env["STAGE"];

/** DynamoDB tables (created by the shared-resources stack). */
export const TENANT_TABLE_NAME = `${stage}-shared-resources-tenant`;
export const SETUP_WIZARD_TABLE_NAME = `${stage}-shared-resources-setup-wizard`;

/** SQS queue that receives tenants ready to be provisioned (shared-resources stack). */
export const TENANT_QUEUE_NAME = `${stage}-shared-resources-tenant-queue`;

export enum SetupWizardStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETE = "COMPLETE",
}

export enum SetupWizardStep {
  WELCOME = "WELCOME",
  CONNECT_INTEGRATIONS = "CONNECT_INTEGRATIONS",
  REVIEW = "REVIEW",
  COMPLETE = "COMPLETE",
}
