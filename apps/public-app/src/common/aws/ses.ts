import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Logger } from "../logger";
import { errorMessage, isValidEmail } from "../utils";

export class SESService {
  private client: SESClient;

  constructor() {
    const region = process.env["AWS_REGION"];
    if (!region) {
      throw new Error("Missing AWS_REGION environment variable");
    }
    this.client = new SESClient({ region });
  }

  /** Sends an HTML email. Validates both the sender and recipient addresses first. */
  async sendEmail(subject: string, htmlBody: string, recipient: string): Promise<void> {
    const source = process.env["SES_SOURCE_EMAIL"];
    if (!source) {
      throw new Error("Missing SES_SOURCE_EMAIL environment variable");
    }
    if (!isValidEmail(source)) {
      throw new Error(`Invalid SES source email address: ${source}`);
    }
    if (!isValidEmail(recipient)) {
      throw new Error(`Invalid recipient email address: ${recipient}`);
    }

    try {
      const result = await this.client.send(
        new SendEmailCommand({
          Source: source,
          Destination: { ToAddresses: [recipient] },
          Message: {
            Subject: { Data: subject },
            Body: { Html: { Data: htmlBody } },
          },
        }),
      );
      Logger.debug("SES email sent, MessageId:", result.MessageId);
    } catch (error) {
      Logger.error("Error sending email via SES:", error);
      throw new Error(`SES sendEmail failed: ${errorMessage(error)}`);
    }
  }
}
