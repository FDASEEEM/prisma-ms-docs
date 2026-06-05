import { InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { SupabaseService } from "../../src/infrastructure/supabase/supabase.service";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

describe("SupabaseService", () => {
  const createClientMock = createClient as jest.Mock;
  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when Supabase env vars are missing", async () => {
    configServiceMock.get.mockReturnValue(undefined);
    const service = new SupabaseService(
      configServiceMock as unknown as ConfigService,
    );

    await expect(service.getUser("token")).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it("returns the user when the token is valid", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "SUPABASE_URL" ? "https://project.supabase.co" : "anon-key",
    );

    const authMock = {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "user@example.com" } },
        error: null,
      }),
    };
    createClientMock.mockReturnValue({ auth: authMock });

    const service = new SupabaseService(
      configServiceMock as unknown as ConfigService,
    );

    await expect(service.getUser("token")).resolves.toEqual({
      id: "user-1",
      email: "user@example.com",
    });
  });

  it("rejects invalid access tokens", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "SUPABASE_URL" ? "https://project.supabase.co" : "anon-key",
    );

    const authMock = {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "bad token" },
      }),
    };
    createClientMock.mockReturnValue({ auth: authMock });

    const service = new SupabaseService(
      configServiceMock as unknown as ConfigService,
    );

    await expect(service.getUser("bad-token")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
