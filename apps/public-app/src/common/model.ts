export interface CreateTenantInput {
  tenantId: string;
  companyName: string;
  email: string;
}

export interface ResendVerificationCodeInput {
  email: string;
}
