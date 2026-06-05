import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ChatService } from "../../src/chat/chat.service";
import { S3Service } from "../../src/infrastructure/storage/s3.service";

describe("ChatService additional cases", () => {
  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "key",
        AWS_SECRET_ACCESS_KEY: "secret",
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

  it("accepts PACI docx uploads and uses the .docx key", async () => {
    s3ServiceMock.uploadObject.mockResolvedValue({ bucket: "b", key: "k" });

    await service.startChat({
      paciFile: {
        originalname: "paci.DOCX",
        mimetype:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    });

    const putCommand = sendMock.mock.calls[0][0] as PutItemCommand;
    const sessionId = putCommand.input.Item?.session_id?.S ?? "";

    expect(s3ServiceMock.uploadObject).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key: `jobs/${sessionId}/paci.docx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
  });

  it("falls back to content type based on file extension", async () => {
    s3ServiceMock.uploadObject.mockResolvedValue({ bucket: "b", key: "k" });

    await service.startChat({
      paciFile: {
        originalname: "paci.pdf",
        mimetype: "",
        buffer: Buffer.from("paci"),
      },
      materialFile: {
        originalname: "material.docx",
        mimetype: "",
        buffer: Buffer.from("material"),
      },
      prompt: "hola",
      schoolId: "colegio_1",
    });

    const paciCall = s3ServiceMock.uploadObject.mock.calls[0][0];
    const materialCall = s3ServiceMock.uploadObject.mock.calls[1][0];

    expect(paciCall.contentType).toBe("application/pdf");
    expect(materialCall.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("rejects non-docx material files", async () => {
    await expect(
      service.startChat({
        paciFile: {
          originalname: "paci.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("paci"),
        },
        materialFile: {
          originalname: "material.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("material"),
        },
        prompt: "hola",
        schoolId: "colegio_1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(s3ServiceMock.uploadObject).not.toHaveBeenCalled();
  });
});
