import { InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConditionalCheckFailedException,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoService } from "../../src/infrastructure/dynamo/dynamo.service";

describe("DynamoService", () => {
  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when the DynamoDB table is missing", async () => {
    configServiceMock.get.mockReturnValue(undefined);
    const service = new DynamoService(
      configServiceMock as unknown as ConfigService,
    );

    await expect(
      service.createJobSession(
        "session-1",
        "user-1",
        "jobs/session-1/paci.json",
        "jobs/session-1/material.docx",
        "hola",
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it("ignores duplicate session writes", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "DYNAMO_TABLE" ? "sessions" : "us-east-1",
    );

    const service = new DynamoService(
      configServiceMock as unknown as ConfigService,
    );
    const sendMock = jest
      .fn()
      .mockRejectedValue(new ConditionalCheckFailedException({ message: "exists" } as any));
    jest.spyOn(service as any, "getClient").mockReturnValue({ send: sendMock });

    await expect(
      service.createJobSession(
        "session-1",
        "user-1",
        "jobs/session-1/paci.json",
        "jobs/session-1/material.docx",
        "hola",
      ),
    ).resolves.toBeUndefined();
  });

  it("writes a job session item", async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DYNAMO_TABLE: "sessions",
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "key",
        AWS_SECRET_ACCESS_KEY: "secret",
      };
      return values[key];
    });

    const service = new DynamoService(
      configServiceMock as unknown as ConfigService,
    );
    const sendMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(service as any, "getClient").mockReturnValue({ send: sendMock });

    await expect(
      service.createJobSession(
        "session-1",
        "user-1",
        "jobs/session-1/paci.json",
        "jobs/session-1/material.docx",
        "hola",
      ),
    ).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenCalledWith(expect.any(PutItemCommand));
    const command = sendMock.mock.calls[0][0] as PutItemCommand;
    expect(command.input?.TableName).toBe("sessions");
    expect(command.input?.Item?.session_id?.S).toBe("session-1");
    expect(command.input?.Item?.user_id?.S).toBe("user-1");
  });

  it("returns an empty list when history is disabled", async () => {
    configServiceMock.get.mockReturnValue(undefined);
    const service = new DynamoService(
      configServiceMock as unknown as ConfigService,
    );

    await expect(service.listSessionsByUser("user-1")).resolves.toEqual([]);
  });

  it("maps and sorts session history", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "DYNAMO_TABLE" ? "sessions" : "us-east-1",
    );

    const service = new DynamoService(
      configServiceMock as unknown as ConfigService,
    );
    const sendMock = jest.fn().mockResolvedValue({
      Items: [
        {
          session_id: { S: "session-a" },
          phase: { S: "running" },
          workflow_status: { S: "" },
          prompt: { S: "hola" },
          created_at: { S: "2024-01-01T10:00:00.000Z" },
          docx_s3_key: { S: "docs/a.docx" },
          error: { S: "" },
        },
        {
          session_id: { S: "session-b" },
          phase: { S: "done" },
          workflow_status: { S: "completed" },
          prompt: { S: "adios" },
          created_at: { S: "2024-01-02T10:00:00.000Z" },
          docx_s3_key: { S: "docs/b.docx" },
          error: { S: "" },
        },
      ],
    });
    jest.spyOn(service as any, "getClient").mockReturnValue({ send: sendMock });

    const result = await service.listSessionsByUser("user-1");

    expect(sendMock).toHaveBeenCalledWith(expect.any(ScanCommand));
    expect(result).toHaveLength(2);
    expect(result[0].sessionId).toBe("session-b");
    expect(result[1].sessionId).toBe("session-a");
  });

  it("returns an empty list when DynamoDB fails", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "DYNAMO_TABLE" ? "sessions" : "us-east-1",
    );

    const service = new DynamoService(
      configServiceMock as unknown as ConfigService,
    );
    const sendMock = jest.fn().mockRejectedValue(new Error("boom"));
    jest.spyOn(service as any, "getClient").mockReturnValue({ send: sendMock });

    await expect(service.listSessionsByUser("user-1")).resolves.toEqual([]);
  });
});
