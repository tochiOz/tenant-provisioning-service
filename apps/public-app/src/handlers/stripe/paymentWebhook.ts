import "source-map-support/register";
import { Logger } from "../../common/logger";
import { ApiResponse, Responses, ValidationError } from "../../common/response";
import { StripeService } from "../../common/services/stripe.service";

/** POST /verify/payment-webhook — Stripe webhook. */
export const handler = async (event: any): Promise<ApiResponse> => {
  try {
    if (!event.body) {
      return Responses.BadRequest({ message: "Bad Request: Credentials not found" }, "MISSING_CREDENTIALS");
    }

    await new StripeService().handleStripeWebhook(event);

    return Responses.OK({ message: "Tenant Webhook Registered" });
  } catch (error) {
    Logger.error("Error handling Stripe webhook", error);

    if (error instanceof ValidationError) {
      return Responses.ValidationError(error);
    }
    return Responses.InternalServerError({ message: "An unexpected error occurred", error }, "INTERNAL_SERVER_ERROR");
  }
};
