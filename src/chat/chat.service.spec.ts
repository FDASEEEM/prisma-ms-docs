import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ChatService } from "./chat.service";
import { S3Service } from "../infrastructure/storage/s3.service";

describe("ChatService", () => {
  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "test-access-key",
        AWS_SECRET_ACCESS_KEY: "test-secret-key",
        DYNAMO_TABLE: "chat_sessions",
        CHAT_SESSION_DEFAULT_SCHOOL_ID: "colegio_demo",
      };

      return values[key] ?? defaultValue;
    }),
  };

  const s3ServiceMock = {
    uploadObject: jest.fn(),
  };

  let service: ChatService;
  let dynamoSendMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ChatService(
      configServiceMock as unknown as ConfigService,
      s3ServiceMock as unknown as S3Service,
    );

    dynamoSendMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(service as any, "getDynamoClient").mockReturnValue({
      send: dynamoSendMock,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates the DynamoDB session and uploads both files to S3", async () => {
    s3ServiceMock.uploadObject.mockResolvedValue({
      bucket: "bucket",
      key: "key",
    });

    const result = await service.startChat({
      paciFile: {
        originalname: "paci.PDF",
        mimetype: "application/pdf",
        buffer: Buffer.from("paci"),
      },
      materialFile: {
        originalname: "material.DOCX",
        mimetype:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from("material"),
      },
      prompt: "   hola   ",
      schoolId: "  colegio_1  ",
    });

    expect(result.session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(dynamoSendMock).toHaveBeenCalledTimes(1);
    expect(dynamoSendMock.mock.calls[0][0]).toBeInstanceOf(PutItemCommand);

    const putCommand = dynamoSendMock.mock.calls[0][0] as PutItemCommand;
    expect(putCommand.input.TableName).toBe("chat_sessions");
    expect(putCommand.input.Item?.session_id.S).toBe(result.session_id);
    expect(putCommand.input.Item?.prompt.S).toBe("   hola   ");
    expect(putCommand.input.Item?.school_id.S).toBe("colegio_1");

    expect(s3ServiceMock.uploadObject).toHaveBeenCalledTimes(2);
    expect(s3ServiceMock.uploadObject).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key: `jobs/${result.session_id}/paci.pdf`,
        contentType: "application/pdf",
      }),
    );
    expect(s3ServiceMock.uploadObject).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        key: `jobs/${result.session_id}/material.docx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
  });

  it("cleans up the DynamoDB record when the S3 upload fails", async () => {
    s3ServiceMock.uploadObject
      .mockResolvedValueOnce({ bucket: "bucket", key: "paci" })
      .mockRejectedValueOnce(new Error("boom"));

    await expect(
      service.startChat({
        paciFile: {
          originalname: "paci.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("paci"),
        },
        materialFile: {
          originalname: "material.docx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: Buffer.from("material"),
        },
        prompt: "",
        schoolId: "colegio_1",
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(dynamoSendMock).toHaveBeenCalledTimes(2);
    expect(dynamoSendMock.mock.calls[0][0]).toBeInstanceOf(PutItemCommand);
    expect(dynamoSendMock.mock.calls[1][0]).toBeInstanceOf(DeleteItemCommand);
  });

  it("rejects files that do not match the expected formats", async () => {
    await expect(
      service.startChat({
        paciFile: {
          originalname: "paci.txt",
          mimetype: "text/plain",
          buffer: Buffer.from("paci"),
        },
        materialFile: {
          originalname: "material.docx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: Buffer.from("material"),
        },
        prompt: "",
        schoolId: "colegio_1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dynamoSendMock).not.toHaveBeenCalled();
    expect(s3ServiceMock.uploadObject).not.toHaveBeenCalled();
  });
});