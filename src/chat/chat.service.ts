import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Service } from "../infrastructure/storage/s3.service";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type StartChatInput = {
  userId: string;
  paciFile: UploadedFile;
  materialFile: UploadedFile;
  prompt: string;
  schoolId: string;
};

@Injectable()
export class ChatService {
  private dynamoClient?: DynamoDBClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {}

  async startChat(input: StartChatInput): Promise<{ session_id: string }> {
    const sessionId = crypto.randomUUID();
    const schoolId =
      input.schoolId?.trim() ||
      this.configService.get<string>("CHAT_SESSION_DEFAULT_SCHOOL_ID", "colegio_demo");
    const paciFileName = input.paciFile.originalname.toLowerCase();
    const materialFileName = input.materialFile.originalname.toLowerCase();

    this.assertPdfOrDocxFile(input.paciFile, "paci_file");
    this.assertDocxFile(input.materialFile, "material_file");

    const paciExt = paciFileName.endsWith(".docx") ? ".docx" : ".pdf";
    const paciKey = `jobs/${sessionId}/paci${paciExt}`;
    const materialKey = `jobs/${sessionId}/material.docx`;

    await this.createSessionRecord(sessionId, {
      userId: input.userId,
      phase: "running",
      prompt: input.prompt,
      schoolId,
      paciS3Key: paciKey,
      materialS3Key: materialKey,
    });

    try {
      await this.s3Service.uploadObject({
        key: paciKey,
        body: input.paciFile.buffer,
        contentType: this.normalizeContentType(input.paciFile.mimetype, paciFileName, "application/pdf"),
      });

      await this.s3Service.uploadObject({
        key: materialKey,
        body: input.materialFile.buffer,
        contentType: this.normalizeContentType(
          input.materialFile.mimetype,
          materialFileName,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      });

      return { session_id: sessionId };
    } catch (error: unknown) {
      await this.deleteSessionRecord(sessionId);
      throw new InternalServerErrorException(
        error instanceof Error
          ? `Error al subir archivos a S3: ${error.message}`
          : "Error al subir archivos a S3.",
      );
    }
  }

  private assertPdfOrDocxFile(file: UploadedFile, fieldName: string): void {
    const name = file.originalname.toLowerCase();
    const mime = file.mimetype.toLowerCase();
    const isPdf =
      mime === "application/pdf" || name.endsWith(".pdf");
    const isDocx =
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx");

    if (!isPdf && !isDocx) {
      throw new BadRequestException(`${fieldName} must be a PDF or DOCX file.`);
    }
  }

  private assertDocxFile(file: UploadedFile, fieldName: string): void {
    const isDocx =
      file.mimetype.toLowerCase() ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx");

    if (!isDocx) {
      throw new BadRequestException(`${fieldName} must be a DOCX file.`);
    }
  }

  private normalizeContentType(
    mimetype: string,
    fileName: string,
    fallback: string,
  ): string {
    if (mimetype) {
      return mimetype.toLowerCase();
    }

    return fileName.endsWith(".pdf")
      ? "application/pdf"
      : fallback;
  }

  private async createSessionRecord(
    sessionId: string,
    payload: {
      userId: string;
      phase: "running";
      prompt: string;
      schoolId: string;
      paciS3Key: string;
      materialS3Key: string;
    },
  ): Promise<void> {
    const tableName =
      this.configService.get<string>("DYNAMO_TABLE") ??
      this.configService.get<string>("CHAT_SESSIONS_TABLE");

    if (!tableName) {
      throw new InternalServerErrorException(
        "DYNAMO_TABLE is required for chat sessions.",
      );
    }

    const client = this.getDynamoClient();

    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          session_id: { S: sessionId },
          user_id: { S: payload.userId },
          phase: { S: payload.phase },
          prompt: { S: payload.prompt ?? "" },
          school_id: { S: payload.schoolId },
          paci_s3_key: { S: payload.paciS3Key },
          material_s3_key: { S: payload.materialS3Key },
          created_at: { S: new Date().toISOString() },
          updated_at: { S: new Date().toISOString() },
        },
        ConditionExpression: "attribute_not_exists(session_id)",
      }),
    );
  }

  private async deleteSessionRecord(sessionId: string): Promise<void> {
    const tableName =
      this.configService.get<string>("DYNAMO_TABLE") ??
      this.configService.get<string>("CHAT_SESSIONS_TABLE");

    if (!tableName) {
      return;
    }

    const client = this.getDynamoClient();

    try {
      await client.send(
        new DeleteItemCommand({
          TableName: tableName,
          Key: {
            session_id: { S: sessionId },
          },
        }),
      );
    } catch {
      // Ignore cleanup errors.
    }
  }

  private getDynamoClient(): DynamoDBClient {
    if (!this.dynamoClient) {
      const region = this.configService.get<string>("AWS_REGION");
      const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
      const secretAccessKey = this.configService.get<string>("AWS_SECRET_ACCESS_KEY");
      const endpoint = this.configService.get<string>("AWS_DYNAMODB_ENDPOINT");

      if (!region || !accessKeyId || !secretAccessKey) {
        throw new InternalServerErrorException(
          "AWS credentials are required for DynamoDB operations.",
        );
      }

      this.dynamoClient = new DynamoDBClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        ...(endpoint ? { endpoint } : {}),
      });
    }

    return this.dynamoClient;
  }
}
