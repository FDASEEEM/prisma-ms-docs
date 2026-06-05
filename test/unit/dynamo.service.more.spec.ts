import { InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DynamoService } from "../../src/infrastructure/dynamo/dynamo.service";

describe("DynamoService edge cases", () => {
  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when AWS credentials are missing", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "DYNAMO_TABLE" ? "sessions" : undefined,
    );

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

  it("maps optional fields to null when missing", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "DYNAMO_TABLE" ? "sessions" : "us-east-1",
    );

    const service = new DynamoService(
      configServiceMock as unknown as ConfigService,
    );

    const sendMock = jest.fn().mockResolvedValue({
      Items: [
        {
          session_id: { S: "session-1" },
          phase: { S: "running" },
          prompt: { S: "hola" },
          created_at: { S: "2024-01-01T00:00:00.000Z" },
        },
      ],
    });

    jest.spyOn(service as any, "getClient").mockReturnValue({ send: sendMock });

    const result = await service.listSessionsByUser("user-1");

    expect(result).toEqual([
      {
        sessionId: "session-1",
        phase: "running",
        workflowStatus: null,
        prompt: "hola",
        createdAt: "2024-01-01T00:00:00.000Z",
        docxS3Key: null,
        error: null,
      },
    ]);
  });
});
