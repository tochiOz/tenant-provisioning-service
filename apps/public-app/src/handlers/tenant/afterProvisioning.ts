import "source-map-support/register";
import { SQSEvent } from "aws-lambda";
import { Logger } from "../../common/logger";
import { ApiResponse, Responses, ValidationError } from "../../common/response";
import { TenantService } from "../../common/services/tenant.service";
import { TenantRepository } from "../../common/repositories/tenant.repository";
import { SetupWizardService } from "../../common/services/setupWizard.service";
import { SetupWizardRepository } from "../../common/repositories/setupWizard.repository";

/** SQS (post-deployment queue) — sent by the tenant's build; starts onboarding and emails the tenant. */
export const handler = async (event: SQSEvent): Promise<ApiResponse> => {
  try {
    const tenantService = new TenantService(new TenantRepository());
    const setupWizardService = new SetupWizardService(new SetupWizardRepository());

    await Promise.all(
      event.Records.map(async (record) => {
        const { tenantId } = JSON.parse(record.body);
        await setupWizardService.startSetupWizard(tenantId);
        return await tenantService.sendPostDeployEmail(tenantId);
      }),
    );

    return Responses.OK({ message: "Tenant Email Sent successfully" });
  } catch (error) {
    Logger.error("Error after tenant provisioning", error);

    if (error instanceof ValidationError) {
      return Responses.ValidationError(error);
    }
    return Responses.InternalServerError({ message: "An unexpected error occurred", error }, "INTERNAL_SERVER_ERROR");
  }
};
