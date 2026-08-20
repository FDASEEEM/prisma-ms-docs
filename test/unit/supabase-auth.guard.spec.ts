import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { CognitoAuthGuard } from "../../src/auth/guards/supabase-auth.guard";

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "jwks"),
  jwtVerify: jest.fn(),
}));

describe("CognitoAuthGuard", () => {
  const jwtVerifyMock = jwtVerify as jest.Mock;
  const createRemoteJWKSetMock = createRemoteJWKSet as jest.Mock;

  const configServiceMock = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === "COGNITO_REGION") return "us-east-1";
      return undefined;
    }),
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key === "COGNITO_USER_POOL_ID") return "us-east-1_XXXXXXXXX";
      throw new Error(`Missing config: ${key}`);
    }),
  };

  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when the authorization header is missing", async () => {
    const guard = new CognitoAuthGuard(
      configServiceMock as unknown as ConfigService,
    );
    const request = { headers: {} };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("throws when the authorization scheme is invalid", async () => {
    const guard = new CognitoAuthGuard(
      configServiceMock as unknown as ConfigService,
    );
    const request = { headers: { authorization: "Basic token" } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("stores the decoded user data on the request", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-123",
        email: "user@example.com",
        custom: { role: "ADMIN", colegioId: "colegio-1" },
      },
    });

    const guard = new CognitoAuthGuard(
      configServiceMock as unknown as ConfigService,
    );
    const request = { headers: { authorization: "Bearer token-123" } } as {
      headers: { authorization: string };
      user?: unknown;
    };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);

    expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1);
    expect(jwtVerifyMock).toHaveBeenCalledWith("token-123", "jwks", {
      issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX",
    });
    expect(request.user).toEqual({
      id: "user-123",
      email: "user@example.com",
      role: "ADMIN",
      appRole: "ADMIN",
      colegioId: "colegio-1",
    });
  });

  it("throws when the token verification fails", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("boom"));

    const guard = new CognitoAuthGuard(
      configServiceMock as unknown as ConfigService,
    );
    const request = { headers: { authorization: "Bearer bad-token" } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
