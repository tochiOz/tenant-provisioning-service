import type { Model } from "dynamoose/dist/Model";
import { model as newModel } from "dynamoose";
import { omit } from "lodash";
import { logAsync } from "../logger";
import { Tenant } from "../entities/tenant.entity";
import { TenantSchema } from "../schemas/tenant.schema";
import { TENANT_TABLE_NAME } from "../constants";

export class TenantRepository {
  private dbInstance: Model<Tenant>;

  constructor() {
    this.dbInstance = newModel<Tenant>(TENANT_TABLE_NAME, TenantSchema);
  }

  @logAsync("info")
  async createTenant(tenant: Tenant): Promise<Tenant> {
    const newTenant = await this.dbInstance.create(tenant);

    newTenant.created = new Date(newTenant.created!);
    newTenant.updated = new Date(newTenant.updated!);

    return newTenant;
  }

  @logAsync("info")
  async getTenantByTenantUUID(tenantUUID: string): Promise<Tenant> {
    return await this.dbInstance.get({ tenantUUID });
  }

  @logAsync("info")
  async getTenantByTenantId(tenantId: string): Promise<Tenant | undefined> {
    const result = await this.dbInstance
      .query({ tenantId })
      .using(TenantSchema.getAttributeSettingValue("index", "tenantId").name)
      .exec();
    return result[0];
  }

  @logAsync("info")
  async getTenantsByEmail(email: string): Promise<Tenant[]> {
    return await this.dbInstance
      .query({ email })
      .using(TenantSchema.getAttributeSettingValue("index", "email").name)
      .exec();
  }

  @logAsync("info")
  async updateTenant(tenant: Tenant): Promise<Tenant> {
    const tenantData = omit(tenant, ["created", "updated"]);
    return await this.dbInstance.update(tenantData);
  }
}
