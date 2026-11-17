/**
 * Loads `.env.<stage>` for local deploys (preloaded with `node -r ./scripts/loadEnv`).
 * Not used in CodeBuild, where the variables come from the build project.
 */
const shell = require("shelljs");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const REQUIRED = ["STAGE", "AWS_REGION", "ACCOUNT_ID"];
const EXPECTED = [
  "JWT_SECRET",
  "SES_SOURCE_EMAIL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AWS_CUSTOM_DOMAIN",
  "TENANT_BASE_DOMAIN",
  "BACKEND_REPO_URL",
  "GITHUB_CONNECTION_ARN",
];

if (!shell.which("aws")) {
  console.error("The AWS CLI is required but not installed.");
  process.exit(1);
}

const stage = process.env["STAGE"] || process.env["npm_config_stage"] || "dev";
process.env["STAGE"] = stage;

const envFilePath = path.join(__dirname, `../.env.${stage}`);
if (!fs.existsSync(envFilePath)) {
  console.error(`Missing environment file: .env.${stage}`);
  process.exit(1);
}
dotenv.config({ path: envFilePath });

const missingRequired = REQUIRED.filter((key) => !process.env[key]);
if (missingRequired.length) {
  console.error(`Missing required environment variables: ${missingRequired.join(", ")}`);
  process.exit(1);
}

const missingExpected = EXPECTED.filter((key) => !process.env[key]);
if (missingExpected.length) {
  console.warn(`Warning: missing environment variables: ${missingExpected.join(", ")}`);
}

console.log(`Environment loaded for stage: ${stage}`);
