import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConditionalCheckFailedException, DynamoDBClient, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";

export interface SessionSummary {
  sessionId: string;
  phase: string;
  workflowStatus: string | null;
  prompt: string;
  createdAt: string;
  docxS3Key: string | null;
  error: string | null;
}

@Injectable()
export class DynamoService {
  private readonly logger = new Logger(DynamoService.name);
  private client?: DynamoDBClient;

  constructor(private readonly configService: ConfigService) {}

  async createJobSession(
    sessionId: string,
    userId: string,
    paciS3Key: string,
    materialS3Key: string,
    prompt: string,
    schoolId?: string,
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
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 86400;

    try {
      await this.getClient().send(
        new PutItemCommand({
          TableName: table,
          Item: {
            session_id:      { S: sessionId },
            user_id:         { S: userId },
            phase:           { S: "running" },
            prompt:          { S: prompt },
            school_id:       { S: schoolId || "colegio_demo" },
            paci_s3_key:     { S: paciS3Key },
            material_s3_key: { S: materialS3Key },
            messages:        { S: "[]" },
            hitl_data:       { S: "null" },
            error:           { S: "" },
            docx_s3_key:     { S: "" },
            workflow_status: { S: "" },
            created_at:      { S: now },
            updated_at:      { S: now },
            expires_at:      { N: String(expiresAt) },
          },
          ConditionExpression: "attribute_not_exists(session_id)",
        }),
      );
      this.logger.log(`Session created in DynamoDB: ${sessionId} (table=${table})`);
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.warn(`Session ${sessionId} already exists in DynamoDB — skipping write`);
        return;
      }
      this.logger.error(
        `DynamoDB PutItem failed for session ${sessionId} — table=${table} region=${this.configService.get("AWS_REGION")}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "Error writing session to DynamoDB.",
      );
    }
  }

  async listSessionsByUser(userId: string): Promise<SessionSummary[]> {
    const table =
      this.configService.get<string>("DYNAMO_TABLE") ??
      this.configService.get<string>("CHAT_SESSIONS_TABLE");

    if (!table) {
      this.logger.warn("DYNAMO_TABLE not set — returning empty history");
      return [];
    }

    try {
      const result = await this.getClient().send(
        new ScanCommand({
          TableName: table,
          FilterExpression: "user_id = :uid",
          ExpressionAttributeValues: { ":uid": { S: userId } },
          ProjectionExpression:
            "session_id, #ph, workflow_status, prompt, created_at, docx_s3_key, #er",
          ExpressionAttributeNames: { "#ph": "phase", "#er": "error" },
        }),
      );

      return (result.Items ?? [])
        .map((item) => ({
          sessionId:      item.session_id?.S ?? "",
          phase:          item["#ph"]?.S ?? item.phase?.S ?? "running",
          workflowStatus: item.workflow_status?.S || null,
          prompt:         item.prompt?.S ?? "",
          createdAt:      item.created_at?.S ?? "",
          docxS3Key:      item.docx_s3_key?.S || null,
          error:          (item["#er"]?.S ?? item.error?.S) || null,
        }))
        .filter((s) => s.sessionId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
      this.logger.error("DynamoDB scan failed", err instanceof Error ? err.stack : String(err));
      return [];
    }
  }

  private getClient(): DynamoDBClient {
    if (!this.client) {
      const region = this.configService.get<string>("AWS_REGION");
      const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
      const secretAccessKey = this.configService.get<string>(
        "AWS_SECRET_ACCESS_KEY",
      );
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
