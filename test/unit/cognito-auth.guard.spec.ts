import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { CognitoAuthGuard } from "../../src/auth/guards/cognito-auth.guard";
import { UsersLookupService } from "../../src/auth/users-lookup.service";

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

  const usersLookupMock = {
    resolve: jest.fn(),
  };

  const buildGuard = () =>
    new CognitoAuthGuard(
      configServiceMock as unknown as ConfigService,
      usersLookupMock as unknown as UsersLookupService,
    );

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
    const request = { headers: {} };
    await expect(
      buildGuard().canActivate(buildContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws when the authorization scheme is invalid", async () => {
    const request = { headers: { authorization: "Basic token" } };
    await expect(
      buildGuard().canActivate(buildContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("reads role/colegioId from the flat custom:* claims when present", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-123",
        email: "user@example.com",
        "custom:role": "ADMIN",
        "custom:colegioId": "colegio-1",
      },
    });

    const request = { headers: { authorization: "Bearer token-123" } } as {
      headers: { authorization: string };
      user?: unknown;
    };

    await expect(buildGuard().canActivate(buildContext(request))).resolves.toBe(
      true,
    );

    expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1);
    expect(jwtVerifyMock).toHaveBeenCalledWith("token-123", "jwks", {
      issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX",
    });
    expect(usersLookupMock.resolve).not.toHaveBeenCalled();
    expect(request.user).toEqual({
      id: "user-123",
      email: "user@example.com",
      role: "ADMIN",
      appRole: "ADMIN",
      colegioId: "colegio-1",
    });
  });

  it("falls back to ms-users when the token has no role claim", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: { sub: "user-123" },
    });
    usersLookupMock.resolve.mockResolvedValue({
      role: "TEACHER",
      colegioId: "colegio-9",
      email: "teacher@example.com",
    });

    const request = { headers: { authorization: "Bearer token-123" } } as {
      headers: { authorization: string };
      user?: unknown;
    };

    await expect(buildGuard().canActivate(buildContext(request))).resolves.toBe(
      true,
    );

    expect(usersLookupMock.resolve).toHaveBeenCalledWith("user-123", "token-123");
    expect(request.user).toEqual({
      id: "user-123",
      email: "teacher@example.com",
      role: "TEACHER",
      appRole: "TEACHER",
      colegioId: "colegio-9",
    });
  });

  it("throws when the token verification fails", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("boom"));
    const request = { headers: { authorization: "Bearer bad-token" } };
    await expect(
      buildGuard().canActivate(buildContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
