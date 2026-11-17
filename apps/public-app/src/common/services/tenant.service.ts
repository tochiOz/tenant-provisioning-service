import { v4 as uuidv4 } from "uuid";
import { logAsync, logSync, Logger } from "../logger";
import { ValidationError } from "../response";
import { Tenant } from "../entities/tenant.entity";
import { TenantRepository } from "../repositories/tenant.repository";
import { SESService } from "../aws/ses";
import { SQSService } from "../aws/sqs";
import { verificationCodeEmail, tenantReadyEmail } from "../emails/templates";
import { createToken, createVerificationCode, decodeToken, generateVerificationPayload } from "../utils";
import { TENANT_QUEUE_NAME } from "../constants";
import { CreateTenantInput, ResendVerificationCodeInput } from "../model";
import { StripeService } from "./stripe.service";
import { CodePipelineService } from "./codepipeline.service";

/**
 * Tenant lifecycle:
 *   createTenant -> verifyEmailAndSetupPayment -> confirmPaymentDetails (queues provisioning)
 *   -> createTenantProvisions (starts the tenant's pipeline) -> sendPostDeployEmail
 */
export class TenantService {
  private ses: SESService;
  private codePipelineService: CodePipelineService;

  constructor(private tenantRepository: TenantRepository) {
    this.ses = new SESService();
    this.codePipelineService = new CodePipelineService();
  }

  /** Registers a new tenant and emails a verification code. */
  @logAsync("info")
  async createTenant(inputBody: CreateTenantInput): Promise<Tenant> {
    try {
      await this.validateTenantUniqueness(inputBody);
      const { verificationCode, verificationExpiresAt } = generateVerificationPayload();

      const newTenant = {
        tenantUUID: uuidv4(),
        tenantId: inputBody.tenantId.toLowerCase(),
        companyName: inputBody.companyName,
        email: inputBody.email.toLowerCase(),
        verificationCode,
        verificationExpiresAt,
      } as Tenant;

      await this.ses.sendEmail("Verify Email", verificationCodeEmail(verificationCode, newTenant.companyName, newTenant.email), newTenant.email);
      const tenant = await this.tenantRepository.createTenant(newTenant);
      Logger.info(`Tenant created: ${tenant.tenantId}`);

      return tenant;
    } catch (error) {
      Logger.error("Failed to create tenant", error);
      throw error instanceof ValidationError
        ? error
        : new ValidationError("Unexpected error occurred during tenant creation", "CREATE_TENANT_ERROR");
    }
  }

  /** Issues and emails a new verification code. */
  @logAsync("info")
  async verifyEmailAndResendCode(inputBody: ResendVerificationCodeInput): Promise<Tenant> {
    try {
      const tenantByEmail = await this.tenantRepository.getTenantsByEmail(inputBody.email);
      if (tenantByEmail.length === 0) {
        throw new ValidationError(`No Tenant found with Email: ${inputBody.email}`, "TENANT_NOT_FOUND");
      }

      const verificationCode = createVerificationCode();
      const updateTenant = {
        tenantUUID: tenantByEmail[0]?.tenantUUID,
        tenantId: tenantByEmail[0]?.tenantId,
        companyName: tenantByEmail[0]?.companyName,
        email: tenantByEmail[0]?.email,
        verificationCode,
        verificationExpiresAt: Math.floor(Date.now() / 1000) + 300,
      } as unknown as Tenant;

      await this.ses.sendEmail("Verify Email", verificationCodeEmail(verificationCode, updateTenant.companyName, updateTenant.email), updateTenant.email);
      const tenant = await this.tenantRepository.updateTenant(updateTenant);
      Logger.info(`Verification code reissued for tenant: ${tenant.tenantId}`);

      return tenant;
    } catch (error) {
      Logger.error("Failed to resend verification code", error);
      throw error instanceof ValidationError
        ? error
        : new ValidationError("Unexpected error occurred while resending the verification code", "RESEND_TENANT_VERIFICATIONCODE_ERROR");
    }
  }

  /**
   * Checks the verification code, marks the tenant as verified and creates a Stripe SetupIntent.
   * Returns the SetupIntent client secret and a token used later to confirm payment.
   */
  @logAsync("info")
  async verifyEmailAndSetupPayment(email: string, verificationCode: number): Promise<{ setupIntentSecret: string | null; token: string }> {
    try {
      const tenants = await this.tenantRepository.getTenantsByEmail(email);
      if (!tenants || tenants.length === 0) {
        throw new ValidationError(`No Tenant found with Email: ${email}`, "TENANT_NOT_FOUND");
      }

      const verifiedTenant = tenants.find(
        (tenant) => tenant.email == email && Number(tenant.verificationCode) === Number(verificationCode),
      );
      if (!verifiedTenant) {
        throw new ValidationError("Verification Code is invalid or tenant not found", "INVALID_VERIFICATION_CODE");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (verifiedTenant.verificationExpiresAt && Number(verifiedTenant.verificationExpiresAt) < currentTime) {
        throw new ValidationError("Verification Code has expired", "VERIFICATION_CODE_EXPIRED");
      }

      const stripeService = new StripeService();
      const setupIntentSecret = await stripeService.createSetupIntent(verifiedTenant.tenantId, verifiedTenant.email);
      const updatedTenant = await this.tenantRepository.updateTenant({ ...verifiedTenant, isVerified: true, status: "email_verified" } as unknown as Tenant);
      const token = await createToken({
        email: updatedTenant.email,
        id: updatedTenant.tenantUUID,
        name: updatedTenant.companyName,
        tenantId: updatedTenant.tenantId,
        status: updatedTenant.status,
      });

      return { setupIntentSecret, token };
    } catch (error) {
      Logger.error("Failed to verify tenant", error);
      throw error instanceof ValidationError
        ? error
        : new ValidationError("Unexpected error occurred during tenant verification", "VERIFY_TENANT_ERROR");
    }
  }

  /**
   * Called by the client after Stripe confirms the SetupIntent.
   * If the SetupIntent succeeded for this tenant, marks payment active and queues provisioning.
   */
  @logAsync("info")
  async confirmPaymentDetails(token: string, setupIntentId: string): Promise<boolean> {
    try {
      const data: { id: string; tenantId: string } = await decodeToken(token);

      const tenant = await this.tenantRepository.getTenantByTenantUUID(data?.id);
      if (!tenant) throw new ValidationError("Invalid verification token", "INVALID_VERIFICATION_TOKEN");
      if (!tenant.isVerified) throw new ValidationError("Email Not Verified", "EMAIL_NOT_VERIFIED");

      const stripeService = new StripeService();
      const setupIntent = await stripeService.getSetupIntent(setupIntentId);

      if (setupIntent.status !== "succeeded" || setupIntent.metadata?.["tenantId"] !== data.tenantId) {
        Logger.error(`Payment verification failed for tenant: ${data.tenantId}`);
        return false;
      }

      const updatedTenant = await this.tenantRepository.updateTenant({
        ...tenant,
        paymentStatus: "active",
        status: "provisioning",
      } as unknown as Tenant);

      const tenantQueue = new SQSService(TENANT_QUEUE_NAME);
      await tenantQueue.fetchQueueUrl();
      await tenantQueue.enqueue({
        message: `Provision resources for Tenant with Id: ${updatedTenant.tenantUUID}`,
        body: { ...updatedTenant },
      });
      Logger.info(`Queued provisioning for tenant: ${updatedTenant.tenantUUID}`);

      return true;
    } catch (error) {
      Logger.error("Failed to confirm payment", error);
      throw new ValidationError("Confirm Payment Failed", "CONFIRM_PAYMENT_FAILED");
    }
  }

  /**
   * Consumes a provisioning request: creates or updates the tenant's CodePipeline and starts it.
   * The pipeline deploys the tenant's stacks asynchronously.
   */
  @logAsync("info")
  async createTenantProvisions(tenantQueueBody: Tenant): Promise<void> {
    try {
      const tenantId = tenantQueueBody.tenantId;
      Logger.info(`Starting provisioning for tenant: ${tenantId}`);

      await this.tenantRepository.updateTenant({ ...tenantQueueBody, status: "PROVISIONING" } as unknown as Tenant);
      await this.codePipelineService.createOrUpdatePipeline(tenantId);
      const pipelineExecutionId = await this.codePipelineService.startPipeline(tenantId);
      Logger.info(`Started CodePipeline execution: ${pipelineExecutionId}`);

      const tenantDomain = this.getCustomDomain(tenantId);
      await this.tenantRepository.updateTenant({ ...tenantQueueBody, status: "PROVISIONING", customDomain: tenantDomain } as unknown as Tenant);
      Logger.info(`Provisioning started for tenant: ${tenantId}`);
    } catch (error) {
      Logger.error("Failed to provision tenant resources", error);
      await this.tenantRepository.updateTenant({ ...tenantQueueBody, status: "provisioning_failed" } as unknown as Tenant);
      throw new ValidationError("Tenant Provisioning Failed", "TENANT_PROVISIONING_FAILED");
    }
  }

  /** Emails the tenant that their environment is ready. Triggered after the pipeline deploys. */
  @logAsync("info")
  async sendPostDeployEmail(tenantId: string): Promise<void> {
    try {
      const tenant = await this.tenantRepository.getTenantByTenantId(tenantId);
      if (!tenant) {
        throw new ValidationError(`No Tenant found with Tenant Id: ${tenantId}`, "TENANT_NOT_FOUND");
      }

      await this.ses.sendEmail("Your Account Is Ready", tenantReadyEmail(tenant.companyName, tenant.customDomain!, tenant.email), tenant.email);
      Logger.info(`Post-deploy email sent to tenant: ${tenant.tenantId}`);
    } catch (error) {
      Logger.error("Failed to send post-deploy email", error);
      throw error instanceof ValidationError
        ? error
        : new ValidationError("Unexpected error occurred while sending the post-deploy email", "SEND_POST_DEPLOY_EMAIL_ERROR");
    }
  }

  /** Rejects a signup whose tenantId or email is already registered. */
  @logAsync("info")
  private async validateTenantUniqueness(inputBody: CreateTenantInput): Promise<void> {
    if (inputBody.tenantId) {
      const existingTenant = await this.tenantRepository.getTenantByTenantId(inputBody.tenantId.toLowerCase());
      if (existingTenant) {
        throw new ValidationError(`Tenant with tenantId ${inputBody.tenantId} already exists`, "TENANT_ID_EXISTS");
      }
    }

    if (inputBody.email) {
      const tenantsByEmail = await this.tenantRepository.getTenantsByEmail(inputBody.email.toLowerCase());
      if (tenantsByEmail.length > 0) {
        throw new ValidationError(`Tenant with email ${inputBody.email} already exists`, "TENANT_EMAIL_EXISTS");
      }
    }
  }

  /** The tenant's dashboard domain: `<tenantId>.<stage>.<base>` outside prod, `<tenantId>.<base>` in prod. */
  @logSync("info")
  private getCustomDomain(tenantId: string): string {
    const baseDomain = process.env["TENANT_BASE_DOMAIN"];
    const stage = process.env["STAGE"];
    return stage !== "prod" ? `${tenantId}.${stage}.${baseDomain}` : `${tenantId}.${baseDomain}`;
  }
}
