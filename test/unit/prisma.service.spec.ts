import { PrismaService } from "../../src/infrastructure/prisma/prisma.service";

describe("PrismaService", () => {
  it("connects on module init", async () => {
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, "$connect")
      .mockResolvedValue(undefined as never);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("disconnects on module destroy", async () => {
    const service = new PrismaService();
    const disconnectSpy = jest
      .spyOn(service, "$disconnect")
      .mockResolvedValue(undefined as never);

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
