import { Item } from "dynamoose/dist/Item";
import { SetupWizardStatus, SetupWizardStep } from "../constants";

export class SetupWizard extends Item {
  tenantId!: string;
  status!: SetupWizardStatus;
  currentStep!: SetupWizardStep;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
