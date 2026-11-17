import { SQSClient, SendMessageCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { Logger } from "../logger";

export class SQSService {
  private client: SQSClient;
  private queueName: string;
  private queueUrl: string | undefined;

  constructor(queueName: string) {
    this.client = new SQSClient({ region: process.env["AWS_REGION"] });
    this.queueName = queueName;
  }

  async fetchQueueUrl(): Promise<void> {
    try {
      const response = await this.client.send(new GetQueueUrlCommand({ QueueName: this.queueName }));
      this.queueUrl = response.QueueUrl;
      Logger.debug("Queue URL fetched:", this.queueUrl);
    } catch (error) {
      Logger.error("Error fetching queue URL:", error);
      throw error;
    }
  }

  async enqueue(messageBody: unknown): Promise<void> {
    if (!this.queueUrl) await this.fetchQueueUrl();

    try {
      const result = await this.client.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(messageBody),
        }),
      );
      Logger.debug("Message sent, ID:", result.MessageId);
    } catch (error) {
      Logger.error("Error sending message:", error);
      throw error;
    }
  }
}
