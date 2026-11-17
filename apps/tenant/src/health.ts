import { APIGatewayProxyResult } from "aws-lambda";

/**
 * Health check for a provisioned tenant stack.
 * Returns which tenant this stack serves, so a caller can confirm the
 * tenant's environment was deployed and is reachable.
 */
export const handler = async (): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "ok",
      tenantId: process.env["TENANT_ID"],
      stage: process.env["STAGE"],
    }),
  };
};
