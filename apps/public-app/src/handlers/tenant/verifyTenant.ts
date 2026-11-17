import "source-map-support/register";
import { Logger } from "../../common/logger";
import { ApiResponse, Responses, ValidationError } from "../../common/response";
import { TenantService } from "../../common/services/tenant.service";
import { TenantRepository } from "../../common/repositories/tenant.repository";

/** POST /tenant/verify — check the verification code and start Stripe payment setup. */
export const handler = async (event: any): Promise<ApiResponse> => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;
    if (!body) {
      return Responses.BadRequest({ message: "Bad Request: verification code not found" }, "MISSING_BODY");
    }

    const tenantService = new TenantService(new TenantRepository());
    const tenant = await tenantService.verifyEmailAndSetupPayment(body.email, body.verificationCode);

    return Responses.OK({ message: "Tenant Verified", tenant });
  } catch (error) {
    Logger.error("Error during tenant verification", error);

    if (error instanceof ValidationError) {
      return Responses.ValidationError(error);
    }
    return Responses.InternalServerError({ message: "An unexpected error occurred", error }, "INTERNAL_SERVER_ERROR");
  }
};
