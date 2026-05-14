import { ConfigService } from "@nestjs/config";
import { S3Service } from "../../src/infrastructure/storage/s3.service";

describe("S3Service configuration", () => {
  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when AWS credentials are missing", () => {
    configServiceMock.get.mockReturnValue(undefined);
    const service = new S3Service(configServiceMock as unknown as ConfigService);

    expect(() => (service as any).getClientAndBucket()).toThrow(
      "AWS environment variables are required for S3 operations.",
    );
  });

  it("throws when bucket is missing", () => {
    configServiceMock.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "key",
        AWS_SECRET_ACCESS_KEY: "secret",
      };
      return values[key];
    });

    const service = new S3Service(configServiceMock as unknown as ConfigService);

    expect(() => (service as any).getClientAndBucket()).toThrow(
      "S3_BUCKET is required for S3 operations.",
    );
  });
});
