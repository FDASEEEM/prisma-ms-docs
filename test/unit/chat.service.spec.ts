import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ChatService } from "../../src/chat/chat.service";
import { S3Service } from "../../src/infrastructure/storage/s3.service";

describe("ChatService", () => {
  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "key",
        AWS_SECRET_ACCESS_KEY: "secret",
        DYNAMO_TABLE: "chat_sessions",
        CHAT_SESSION_DEFAULT_SCHOOL_ID: "colegio_custom",
      };

      return values[key] ?? defaultValue;
    }),
  };

  const s3ServiceMock = {
    uploadObject: jest.fn(),
  };

  let service: ChatService;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(
      configServiceMock as unknown as ConfigService,
      s3ServiceMock as unknown as S3Service,
    );

    sendMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(service as any, "getDynamoClient").mockReturnValue({
      send: sendMock,
    });
  });

  it("creates the session record and uploads files", async () => {
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
      prompt: "hola",
      schoolId: "  ",
    });

    const putCommand = sendMock.mock.calls[0][0] as PutItemCommand;
    const sessionId = putCommand.input.Item?.session_id?.S ?? "";

    expect(result.session_id).toBe(sessionId);
    expect(putCommand.input.Item?.school_id?.S).toBe("colegio_custom");

    expect(s3ServiceMock.uploadObject).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key: `jobs/${sessionId}/paci.pdf`,
        contentType: "application/pdf",
      }),
    );
    expect(s3ServiceMock.uploadObject).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        key: `jobs/${sessionId}/material.docx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
  });

  it("rejects invalid paci file formats", async () => {
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
        prompt: "hola",
        schoolId: "colegio_1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cleans up the session if S3 fails", async () => {
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
        prompt: "hola",
        schoolId: "colegio_1",
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(sendMock).toHaveBeenCalledWith(expect.any(PutItemCommand));
    expect(sendMock.mock.calls.some((call) => call[0] instanceof DeleteItemCommand)).toBe(true);
  });
});
