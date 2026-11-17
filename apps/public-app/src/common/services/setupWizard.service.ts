import { logAsync, Logger } from "../logger";
import { ValidationError } from "../response";
import { SetupWizard } from "../entities/setupWizard.entity";
import { SetupWizardRepository } from "../repositories/setupWizard.repository";
import { SetupWizardStatus, SetupWizardStep } from "../constants";

export class SetupWizardService {
  constructor(private setupWizardRepository: SetupWizardRepository) {}

  /**
   * Creates the tenant's onboarding wizard progress, starting at WELCOME.
   * If it already exists, returns the existing progress.
   */
  @logAsync("info")
  async startSetupWizard(tenantId: string): Promise<SetupWizard> {
    try {
      if (!tenantId) {
        throw new ValidationError("tenantId is required", "TENANT_ID_REQUIRED");
      }

      const existingWizard = await this.setupWizardRepository.getByTenantId(tenantId);
      if (existingWizard) {
        return existingWizard;
      }

      const createdWizard = await this.setupWizardRepository.createSetupWizard({
        tenantId,
        status: SetupWizardStatus.IN_PROGRESS,
        currentStep: SetupWizardStep.WELCOME,
      } as SetupWizard);

      Logger.info(`Setup wizard started for tenant: ${tenantId}`);
      return createdWizard;
    } catch (error) {
      Logger.error("Failed to start setup wizard", error);
      throw error instanceof ValidationError
        ? error
        : new ValidationError("Unexpected error occurred while starting setup wizard", "START_SETUP_WIZARD_ERROR");
    }
  }
}
