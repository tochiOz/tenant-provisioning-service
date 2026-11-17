import Stripe from "stripe";
import { logAsync, Logger } from "../logger";
import { ValidationError } from "../response";
import { Tenant } from "../entities/tenant.entity";
import { TenantRepository } from "../repositories/tenant.repository";

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!, {
      apiVersion: "2025-01-27.acacia",
    });
  }

  /**
   * Creates a Stripe SetupIntent so the tenant can save a payment method without being charged.
   * Returns the SetupIntent's client secret for the frontend.
   */
  @logAsync("info")
  async createSetupIntent(tenantId: string, email: string): Promise<string | null> {
    try {
      Logger.info(`Creating Stripe SetupIntent for tenant: ${tenantId}`);

      // Reuse the Stripe customer if one already exists for this email
      const { data: existingCustomers } = await this.stripe.customers.list({ email });
      const customer =
        existingCustomers.length > 0
          ? existingCustomers[0]
          : await this.stripe.customers.create({ email, metadata: { tenantId, email } });

      const setupIntent = await this.stripe.setupIntents.create({
        customer: customer?.id,
        payment_method_types: ["card"],
        metadata: { tenantId, email },
      });
      Logger.info(`SetupIntent created: ${setupIntent.id}`);

      return setupIntent.client_secret;
    } catch (error) {
      Logger.error("Failed to create SetupIntent", error);
      throw new ValidationError("Failed to create SetupIntent", "STRIPE_SETUP_INTENT_ERROR");
    }
  }

  /** Handles Stripe webhook events. Only `setup_intent.succeeded` is acted on. */
  @logAsync("info")
  async handleStripeWebhook(event: { body: string; headers: Record<string, string> }): Promise<void> {
    try {
      const signature = event.headers["Stripe-Signature"] || event.headers["stripe-signature"];
      if (!signature) {
        throw new ValidationError("Stripe signature header missing", "MISSING_STRIPE_SIGNATURE");
      }

      const stripeEvent = this.stripe.webhooks.constructEvent(
        event.body,
        signature,
        process.env["STRIPE_WEBHOOK_SECRET"]!,
      );
      Logger.info(`Received Stripe webhook: ${stripeEvent.type}`);

      if (stripeEvent.type === "setup_intent.succeeded") {
        const setupIntent = stripeEvent.data.object as Stripe.SetupIntent;

        const tenantId = setupIntent.metadata?.["tenantId"];
        if (!tenantId) {
          throw new ValidationError("Tenant ID missing in SetupIntent metadata", "MISSING_TENANT_ID");
        }

        const tenantRepository = new TenantRepository();
        const tenant = await tenantRepository.getTenantByTenantId(tenantId);
        await tenantRepository.updateTenant({ ...tenant, paymentStatus: "active", status: "payment_active" } as unknown as Tenant);
        Logger.info(`Payment status updated for tenant ${tenantId}`);
      }
    } catch (error) {
      Logger.error("Webhook error", error);
      throw new ValidationError("Failed to handle Stripe webhook", "STRIPE_WEBHOOK_ERROR");
    }
  }

  /** Retrieves a SetupIntent by ID. */
  @logAsync("info")
  async getSetupIntent(setupIntentId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.retrieve(setupIntentId);
      if (!setupIntent) {
        throw new ValidationError("SetupIntent not found", "SETUP_INTENT_NOT_FOUND");
      }
      return setupIntent;
    } catch (error) {
      Logger.error("Failed to retrieve SetupIntent", error);
      throw new ValidationError("Failed to retrieve Stripe SetupIntent", "STRIPE_SETUP_INTENT_RETRIEVE_ERROR");
    }
  }
}
