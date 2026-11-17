import "source-map-support/register";
import { Logger } from "../../common/logger";
import { ApiResponse, Responses, ValidationError } from "../../common/response";
import { TenantService } from "../../common/services/tenant.service";
import { TenantRepository } from "../../common/repositories/tenant.repository";

/** POST /tenant — register a new tenant and email a verification code. */
export const handler = async (event: any): Promise<ApiResponse> => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;
    if (!body) {
      return Responses.BadRequest({ message: "Bad Request: Credentials not found" }, "MISSING_CREDENTIALS");
    }

    const tenantService = new TenantService(new TenantRepository());
    const tenant = await tenantService.createTenant(body);

    return Responses.Created({ message: "Tenant Created", tenant });
  } catch (error) {
    Logger.error("Error while adding a new tenant", error);

    if (error instanceof ValidationError) {
      return Responses.ValidationError(error);
    }
    return Responses.InternalServerError({ message: "An unexpected error occurred", error }, "INTERNAL_SERVER_ERROR");
  }
};
