import "source-map-support/register";
import { SQSEvent } from "aws-lambda";
import { Logger } from "../../common/logger";
import { ApiResponse, Responses, ValidationError } from "../../common/response";
import { TenantService } from "../../common/services/tenant.service";
import { TenantRepository } from "../../common/repositories/tenant.repository";

/** SQS (tenant queue) — start provisioning for each queued tenant. */
export const handler = async (event: SQSEvent): Promise<ApiResponse> => {
  try {
    const tenantService = new TenantService(new TenantRepository());

    await Promise.all(
      event.Records.map(async (record) => {
        const message = JSON.parse(record.body);
        return await tenantService.createTenantProvisions(message.body);
      }),
    );

    return Responses.Created({ message: "Tenant provisioning started" });
  } catch (error) {
    Logger.error("Error during tenant provisioning", error);

    if (error instanceof ValidationError) {
      return Responses.ValidationError(error);
    }
    return Responses.InternalServerError({ message: "An unexpected error occurred", error }, "INTERNAL_SERVER_ERROR");
  }
};
