import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { CognitoAuthGuard } from "../../src/auth/guards/supabase-auth.guard";

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

  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts Bearer with different casing", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "user-1", custom: {} } });

    const guard = new CognitoAuthGuard(
      configServiceMock as unknown as ConfigService,
    );
    const request = {
      headers: { authorization: "bEaReR token-1" },
    } as { headers: { authorization: string }; user?: unknown };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: "user-1", email: undefined, role: undefined, appRole: undefined, colegioId: null });
  });

  it("rejects bearer header without token", async () => {
    const guard = new CognitoAuthGuard(
      configServiceMock as unknown as ConfigService,
    );

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: "Bearer" } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
