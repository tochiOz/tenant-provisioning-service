const { execSync } = require("child_process");

/** `--profile <name>` when AWS_PROFILE is set (local runs), nothing in CodeBuild. */
const profileFlag = (flag = "--profile") =>
  process.env["AWS_PROFILE"] ? `${flag} ${process.env["AWS_PROFILE"]}` : "";

const bucketExists = (bucketName) => {
  try {
    execSync(`aws s3api head-bucket --bucket "${bucketName}" --region ${process.env["AWS_REGION"]} ${profileFlag()}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/** Creates an S3 bucket if it doesn't already exist. */
const createBucket = (bucketName) => {
  if (bucketExists(bucketName)) {
    console.log(`Bucket "${bucketName}" already exists.`);
    return;
  }

  const region = process.env["AWS_REGION"];
  execSync(
    `aws s3api create-bucket --bucket "${bucketName}" --region ${region} ${profileFlag()} --create-bucket-configuration LocationConstraint=${region}`,
    { stdio: "inherit" },
  );
  console.log(`Bucket "${bucketName}" created.`);
};

module.exports = { createBucket, profileFlag };
