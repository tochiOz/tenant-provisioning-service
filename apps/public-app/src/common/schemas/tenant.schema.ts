import { Schema } from "dynamoose";
import validator from "validator";

const millisecondsDate = {
  type: {
    value: Date,
    settings: { storage: "milliseconds" as const },
  },
};

export const TenantSchema = new Schema(
  {
    tenantUUID: {
      type: String,
      required: true,
      validate: (value) => validator.isUUID(value.toString(), 4),
      hashKey: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: { name: "TenantIdIndex", type: "global" },
    },
    email: {
      type: String,
      required: true,
      index: { name: "TenantEmailIndex", type: "global" },
    },
    status: {
      type: String,
      required: true,
      default: "pending",
    },
    companyName: { type: String, required: true },
    verificationCode: { type: Number, required: false },
    verificationExpiresAt: { type: Number, required: false },
    isVerified: { type: Boolean, required: false, default: false },
    paymentStatus: { type: String, required: false },
    customDomain: { type: String, required: false },
  },
  {
    timestamps: {
      createdAt: { created: millisecondsDate },
      updatedAt: { updated: millisecondsDate },
    },
    saveUnknown: false,
  },
);
