import "source-map-support/register";
import { Logger } from "../../common/logger";
import { ApiResponse, Responses, ValidationError } from "../../common/response";
import { TenantService } from "../../common/services/tenant.service";
import { TenantRepository } from "../../common/repositories/tenant.repository";

/** GET /tenant/resendCode?email= — email a new verification code. */
export const handler = async (event: any): Promise<ApiResponse> => {
  try {
    const queryParams = event.queryStringParameters;
    if (!queryParams?.email) {
      return Responses.BadRequest({ message: "Email must be provided" }, "MISSING_QUERY_PARAMS");
    }

    const tenantService = new TenantService(new TenantRepository());
    await tenantService.verifyEmailAndResendCode(queryParams);

    return Responses.OK({ message: "Code Successfully Sent" });
  } catch (error) {
    Logger.error("Error while resending the verification code", error);

    if (error instanceof ValidationError) {
      return Responses.ValidationError(error);
    }
    return Responses.InternalServerError({ message: "An unexpected error occurred", error }, "INTERNAL_SERVER_ERROR");
  }
};
