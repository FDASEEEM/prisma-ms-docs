import { ConfigService } from "@nestjs/config";
import { JobStatus } from "@prisma/client";
import { JobsService } from "./jobs.service";
import { DynamoService } from "../infrastructure/dynamo/dynamo.service";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { S3Service } from "../infrastructure/storage/s3.service";

describe("JobsService", () => {
  const configServiceMock = {
    get: jest.fn(),
  };

  const prismaServiceMock = {
    job: {
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const s3ServiceMock = {
    uploadObject: jest.fn(),
    createSignedDownloadUrl: jest.fn(),
  };

  const dynamoServiceMock = {
    createJobSession: jest.fn(),
  };

  let service: JobsService;

  beforeEach(() => {
    jest.clearAllMocks();

    configServiceMock.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        if (key === "PACI_DOCUMENTS_URL_EXPIRES_IN") {
          return 900;
        }

        return defaultValue;
      },
    );

    prismaServiceMock.job.create.mockResolvedValue({
      id: "job-123",
    });
    prismaServiceMock.job.update.mockResolvedValue({});
    s3ServiceMock.uploadObject.mockResolvedValue({
      bucket: "bucket",
      key: "key",
    });
    dynamoServiceMock.createJobSession.mockResolvedValue(undefined);

    service = new JobsService(
      prismaServiceMock as unknown as PrismaService,
      s3ServiceMock as unknown as S3Service,
      dynamoServiceMock as unknown as DynamoService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it("forwards the authenticated userId to DynamoDB", async () => {
    await expect(
      service.createUploadJob(
        "user-456",
        {
          prompt: "  revisar esto  ",
          paciJson: JSON.stringify({ foo: "bar" }),
        } as never,
        {
          planningFile: [
            {
              originalname: "plan.docx",
              mimetype:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              buffer: Buffer.from("planning"),
            },
          ],
        },
      ),
    ).resolves.toEqual({ jobId: "job-123", status: JobStatus.pending });

    expect(prismaServiceMock.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-456",
        prompt: "revisar esto",
      }),
    });

    expect(dynamoServiceMock.createJobSession).toHaveBeenCalledWith(
      "job-123",
      "user-456",
      "jobs/job-123/paci.json",
      "jobs/job-123/material.docx",
      "revisar esto",
    );
  });
});
