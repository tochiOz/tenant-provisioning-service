import type { Model } from "dynamoose/dist/Model";
import { model as newModel } from "dynamoose";
import { logAsync } from "../logger";
import { SetupWizard } from "../entities/setupWizard.entity";
import { SetupWizardSchema } from "../schemas/setupWizard.schema";
import { SETUP_WIZARD_TABLE_NAME } from "../constants";

export class SetupWizardRepository {
  private dbInstance: Model<SetupWizard>;

  constructor() {
    this.dbInstance = newModel<SetupWizard>(SETUP_WIZARD_TABLE_NAME, SetupWizardSchema);
  }

  private normalizeDates(setupWizard: SetupWizard): SetupWizard {
    if (setupWizard.createdAt) setupWizard.createdAt = new Date(setupWizard.createdAt);
    if (setupWizard.updatedAt) setupWizard.updatedAt = new Date(setupWizard.updatedAt);
    if (setupWizard.completedAt) setupWizard.completedAt = new Date(setupWizard.completedAt);
    return setupWizard;
  }

  @logAsync("info")
  async createSetupWizard(setupWizard: SetupWizard): Promise<SetupWizard> {
    const created = await this.dbInstance.create(setupWizard);
    return this.normalizeDates(created);
  }

  @logAsync("info")
  async getByTenantId(tenantId: string): Promise<SetupWizard | null> {
    if (!tenantId) {
      throw new Error("tenantId is required");
    }

    const setupWizard = await this.dbInstance.get({ tenantId });
    return setupWizard ? this.normalizeDates(setupWizard) : null;
  }
}
