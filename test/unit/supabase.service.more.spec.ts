import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { SupabaseService } from "../../src/infrastructure/supabase/supabase.service";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

describe("SupabaseService reuse", () => {
  const createClientMock = createClient as jest.Mock;
  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reuses the cached Supabase client", async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === "SUPABASE_URL" ? "https://project.supabase.co" : "anon-key",
    );

    const authMock = {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    };

    createClientMock.mockReturnValue({ auth: authMock });

    const service = new SupabaseService(
      configServiceMock as unknown as ConfigService,
    );

    await service.getUser("token-1");
    await service.getUser("token-2");

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(authMock.getUser).toHaveBeenCalledTimes(2);
  });
});
