# tenant-provisioning-service

A serverless backend for onboarding tenants to a multi-tenant SaaS platform. A new customer signs up, verifies their email, saves a payment method with Stripe, and then gets their own set of AWS resources deployed automatically.

Built with TypeScript on AWS Lambda (Serverless Framework v4), DynamoDB (via dynamoose), SQS, SES, CodePipeline/CodeBuild and Stripe.

## How onboarding works

```
1. POST /tenant                  Register the tenant and email a verification code
   GET  /tenant/resendCode       Email a new code
2. POST /tenant/verify           Check the code, mark the tenant verified, create a Stripe SetupIntent
3. Payment confirmation (two paths):
   POST /tenant/confirmpayment       Client confirms the SetupIntent -> tenant queued for provisioning
   POST /verify/payment-webhook      Stripe webhook (setup_intent.succeeded) updates payment status
4. Tenant queue -> processTenantProvisioning
       Creates or updates the tenant's CodeBuild project and CodePipeline, then starts the pipeline
5. Tenant pipeline -> CodeBuild runs buildspec.yml -> scripts/deploy-tenant.js
       Deploys the tenant's stacks (ten-resources, then tenant), then posts to the post-deployment queue
6. Post-deployment queue -> afterProvisioning
       Starts the tenant's setup wizard and sends the "your account is ready" email
```

Tenant status moves through `email_verified`, `payment_active`, `provisioning` / `PROVISIONING` and `provisioning_failed`, stored on the tenant record.

## Project layout

```
apps/
  shared-resources/   Platform stack: tenant + setup-wizard tables, tenant + post-deployment queues
  public-app/         Platform stack: the public API and the provisioning queue consumers
    src/handlers/       Lambda handlers (tenant signup/verify/payment, Stripe webhook, queue consumers)
    src/common/         Code the handlers share
      services/           tenant, stripe, codepipeline, codebuild, setupWizard
      repositories/       DynamoDB access (dynamoose)
      entities/ schemas/  Tenant and setup-wizard models
      aws/                SQS and SES clients
      emails/             Email templates
      constants.ts logger.ts response.ts utils.ts model.ts
  ten-resources/      Per-tenant stack: the tenant's own tables (example: users)
  tenant/             Per-tenant stack: the tenant's API (placeholder health endpoint)
scripts/
  deploy.js           Deploys the platform stacks (shared-resources, public-app)
  deploy-tenant.js    Deploys one tenant's stacks (ten-resources, tenant)
  loadEnv.js          Loads .env.<stage> for local deploys
  helper.js           S3 bucket helper
buildspec.yml         Run by each tenant's CodeBuild project
```

## Configuration

Local deploys read `.env.<stage>` (never commit it). The platform stacks use:

| Variable | Purpose |
|---|---|
| `STAGE`, `AWS_REGION`, `ACCOUNT_ID` | Deployment target |
| `JWT_SECRET` | Signs the token returned after email verification |
| `SES_SOURCE_EMAIL` | Sender address for emails |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe API and webhook signature verification |
| `AWS_CUSTOM_DOMAIN`, `HOSTED_ZONE_ID` | Custom domain for the APIs |
| `TENANT_BASE_DOMAIN` | Base domain for each tenant's dashboard URL |
| `BACKEND_REPO_URL`, `GITHUB_CONNECTION_ARN`, `GITHUB_BRANCH_NAME` | Source for the per-tenant pipeline (this repository) |

Each tenant's CodeBuild project gets `STAGE`, `TENANT_ID`, `AWS_REGION` and `ACCOUNT_ID`.

## Running

Requires Node.js 18+, the AWS CLI and the Serverless Framework v4.

```bash
npm install
npm run typecheck

npm run deploy --stage=dev                          # shared-resources, then public-app
npm run deploy-tenant --stage=dev --tenant=acme     # one tenant's stacks, by hand
npm run offline --stage=dev --application=public-app
```

## Licence

MIT. See [LICENSE](LICENSE).
