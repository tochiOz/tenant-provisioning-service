import "source-map-support/register";
import { Logger } from "../../common/logger";
import { ApiResponse, Responses, ValidationError } from "../../common/response";
import { TenantService } from "../../common/services/tenant.service";
import { TenantRepository } from "../../common/repositories/tenant.repository";

/** POST /tenant/confirmpayment — confirm the Stripe SetupIntent and queue provisioning. */
export const handler = async (event: any): Promise<ApiResponse> => {
  try {
    const { setupIntentId, token } = JSON.parse(event.body || "{}");
    if (!setupIntentId) {
      return Responses.BadRequest({ message: "Bad Request: Setup Intent Id missing" }, "MISSING_SETUPINTENTID");
    }

    const tenantService = new TenantService(new TenantRepository());
    const confirmed = await tenantService.confirmPaymentDetails(token, setupIntentId);

    return confirmed
      ? Responses.OK({ message: "Payment Details Verified and Saved" })
      : Responses.BadRequest({ message: "Payment Details not Verified, Please try again" }, "PAYMENT_DETAILS_NOT_VERIFIED");
  } catch (error) {
    Logger.error("Error while confirming tenant payment", error);

    if (error instanceof ValidationError) {
      return Responses.ValidationError(error);
    }
    return Responses.InternalServerError({ message: "An unexpected error occurred", error }, "INTERNAL_SERVER_ERROR");
  }
};
