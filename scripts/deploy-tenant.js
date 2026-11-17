/**
 * Deploys one tenant's stacks: ten-resources (the tenant's tables) then tenant (the tenant's API).
 *
 * Runs inside the tenant's CodeBuild project (see buildspec.yml), or locally:
 *   npm run deploy-tenant --stage=dev --tenant=acme
 */
const shell = require("shelljs");
const { createBucket, profileFlag } = require("./helper");

const APPS = ["ten-resources", "tenant"];

const { STAGE, AWS_REGION, ACCOUNT_ID, TENANT_ID, APPLICATION } = process.env;
if (!STAGE || !AWS_REGION || !ACCOUNT_ID || !TENANT_ID) {
  console.error("Missing required environment variables (STAGE, AWS_REGION, ACCOUNT_ID, TENANT_ID).");
  process.exit(1);
}

const run = (command, failureMessage) => {
  if (shell.exec(command).code !== 0) {
    console.error(failureMessage);
    process.exit(1);
  }
};

shell.cd("apps");
const appsToDeploy = APPLICATION ? [APPLICATION] : APPS;
console.log(`Deploying ${appsToDeploy.join(", ")} for tenant ${TENANT_ID} (stage=${STAGE}, region=${AWS_REGION})`);

appsToDeploy.forEach((application) => {
  shell.cd(application);

  run(shell.test("-e", "package-lock.json") ? "npm ci" : "npm install", `Installing dependencies failed for ${application}.`);
  createBucket(`s3-${STAGE}-${TENANT_ID}-${AWS_REGION}.${ACCOUNT_ID}.deploys.${application}`);

  if (application === "tenant") {
    run("serverless create_domain", `Failed to create the custom domain for tenant ${TENANT_ID}.`);
  }

  run(`serverless deploy --stage ${STAGE} --region ${AWS_REGION} ${profileFlag("--aws-profile")}`, `Deployment of ${application} failed for tenant ${TENANT_ID}.`);
  shell.cd("..");
});

console.log(`Tenant ${TENANT_ID} deployed.`);
