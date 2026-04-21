import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

@Injectable()
export class DynamoService {
  private client?: DynamoDBClient;

  constructor(private readonly configService: ConfigService) {}

  async createJobSession(
    sessionId: string,
    paciS3Key: string,
    materialS3Key: string,
    prompt: string,
  ): Promise<void> {
    const table =
      this.configService.get<string>("DYNAMO_TABLE") ??
      this.configService.get<string>("CHAT_SESSIONS_TABLE");

    if (!table) {
      throw new InternalServerErrorException(
        "DYNAMO_TABLE is required for job sessions.",
      );
    }

    const now = new Date().toISOString();

    await this.getClient().send(
      new PutItemCommand({
        TableName: table,
        Item: {
          session_id:      { S: sessionId },
          phase:           { S: "running" },
          prompt:          { S: prompt },
          school_id:       { S: "colegio_demo" },
          paci_s3_key:     { S: paciS3Key },
          material_s3_key: { S: materialS3Key },
          created_at:      { S: now },
          updated_at:      { S: now },
        },
        ConditionExpression: "attribute_not_exists(session_id)",
      }),
    );
  }

  private getClient(): DynamoDBClient {
    if (!this.client) {
      const region = this.configService.get<string>("AWS_REGION");
      const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
      const secretAccessKey = this.configService.get<string>("AWS_SECRET_ACCESS_KEY");
      const endpoint = this.configService.get<string>("AWS_DYNAMODB_ENDPOINT");

      if (!region || !accessKeyId || !secretAccessKey) {
        throw new InternalServerErrorException(
          "AWS credentials are required for DynamoDB operations.",
        );
      }

      this.client = new DynamoDBClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
        ...(endpoint ? { endpoint } : {}),
      });
    }
    return this.client;
  }
}
