import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { CognitoAuthGuard } from "../../src/auth/guards/cognito-auth.guard";
import { UsersLookupService } from "../../src/auth/users-lookup.service";

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "jwks"),
  jwtVerify: jest.fn(),
}));

describe("CognitoAuthGuard edge cases", () => {
  const jwtVerifyMock = jwtVerify as jest.Mock;
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
    resolve: jest.fn().mockResolvedValue({ colegioId: null }),
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
    usersLookupMock.resolve.mockResolvedValue({ colegioId: null });
  });

  it("accepts Bearer with different casing", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "user-1" } });

    const request = {
      headers: { authorization: "bEaReR token-1" },
    } as { headers: { authorization: string }; user?: unknown };

    await expect(buildGuard().canActivate(buildContext(request))).resolves.toBe(
      true,
    );
    expect(request.user).toEqual({
      id: "user-1",
      email: undefined,
      role: undefined,
      appRole: undefined,
      colegioId: null,
    });
  });

  it("rejects bearer header without token", async () => {
    await expect(
      buildGuard().canActivate(buildContext({ headers: { authorization: "Bearer" } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
