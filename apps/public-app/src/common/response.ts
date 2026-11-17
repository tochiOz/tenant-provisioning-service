type JSONRecord = Record<string, any>;

export interface ApiResponse {
  headers: Record<string, string>;
  statusCode: number;
  body: string;
}

export class ValidationError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, errorCode: string = "VALIDATION_ERROR") {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
    this.errorCode = errorCode;
  }
}

export class Responses {
  private static createResponse(statusCode: number, data: JSONRecord): ApiResponse {
    return {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
      statusCode,
      body: JSON.stringify(data),
    };
  }

  public static OK(data: JSONRecord = {}): ApiResponse {
    return this.createResponse(200, data);
  }

  public static Created(data: JSONRecord = {}): ApiResponse {
    return this.createResponse(201, data);
  }

  public static BadRequest(data: JSONRecord = {}, errorCode?: string): ApiResponse {
    return this.createResponse(400, { ...data, errorCode });
  }

  public static InternalServerError(data: JSONRecord = {}, errorCode?: string): ApiResponse {
    return this.createResponse(500, { ...data, errorCode });
  }

  public static ValidationError(error: ValidationError): ApiResponse {
    return this.createResponse(400, {
      message: error.message,
      errorCode: error.errorCode,
    });
  }
}
