import { Item } from "dynamoose/dist/Item";

export class Tenant extends Item {
  tenantUUID!: string;
  tenantId!: string;
  companyName!: string;
  email!: string;
  status!: string;
  verificationCode?: number;
  verificationExpiresAt?: number;
  isVerified?: boolean;
  paymentStatus?: string;
  customDomain?: string;
  created?: Date;
  updated?: Date;
}
