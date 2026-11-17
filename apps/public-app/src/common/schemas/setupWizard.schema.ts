import { Schema } from "dynamoose";
import { SetupWizardStatus, SetupWizardStep } from "../constants";

const millisecondsDate = {
  type: {
    value: Date,
    settings: { storage: "milliseconds" as const },
  },
};

export const SetupWizardSchema = new Schema(
  {
    tenantId: {
      type: String,
      required: true,
      hashKey: true,
    },
    status: {
      type: String,
      required: true,
      default: SetupWizardStatus.IN_PROGRESS,
      enum: Object.values(SetupWizardStatus),
    },
    currentStep: {
      type: String,
      required: true,
      default: SetupWizardStep.WELCOME,
      enum: Object.values(SetupWizardStep),
    },
    completedAt: { type: Date, required: false },
  },
  {
    timestamps: {
      createdAt: { createdAt: millisecondsDate },
      updatedAt: { updatedAt: millisecondsDate },
    },
    saveUnknown: false,
  },
);
