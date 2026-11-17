/**
 * Deploys the platform stacks, once per stage:
 *   shared-resources (tables, queues) then public-app (API, provisioning).
 *
 *   npm run deploy --stage=dev
 *   npm run deploy --stage=dev --application=public-app
 *   npm run offline --stage=dev --application=public-app
 */
const shell = require("shelljs");
const { createBucket, profileFlag } = require("./helper");

const APPS = ["shared-resources", "public-app"];

const { STAGE, AWS_REGION, ACCOUNT_ID, APPLICATION, OFFLINE } = process.env;
if (!STAGE || !AWS_REGION || !ACCOUNT_ID) {
  console.error("Missing required environment variables (STAGE, AWS_REGION, ACCOUNT_ID).");
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
console.log(`Deploying ${appsToDeploy.join(", ")} (stage=${STAGE}, region=${AWS_REGION})`);

appsToDeploy.forEach((application) => {
  shell.cd(application);

  if (OFFLINE) {
    run(`serverless offline --stage ${STAGE} --region ${AWS_REGION} ${profileFlag("--aws-profile")}`, `Offline start failed for ${application}.`);
  } else {
    run(shell.test("-e", "package-lock.json") ? "npm ci" : "npm install", `Installing dependencies failed for ${application}.`);
    createBucket(`s3-${STAGE}-${AWS_REGION}.${ACCOUNT_ID}.deploys.${application}`);

    if (application === "public-app") {
      // Artifact store for the per-tenant pipelines
      createBucket(`s3-${STAGE}-${AWS_REGION}.${ACCOUNT_ID}.pipeline-artifacts`);
      run("serverless create_domain", `Failed to create the custom domain for ${application}.`);
    }

    run(`serverless deploy --stage ${STAGE} --region ${AWS_REGION} ${profileFlag("--aws-profile")}`, `Deployment failed for ${application}.`);
  }

  shell.cd("..");
});

console.log("Deployment completed.");
