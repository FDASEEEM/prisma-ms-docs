import "reflect-metadata";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { AppController } from "../../src/app.controller";
import { AppModule } from "../../src/app.module";

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "jwks"),
  jwtVerify: jest.fn(),
}));

const getModuleMetadata = (key: string) =>
  Reflect.getMetadata(key, AppModule) as unknown[] | undefined;

describe("AppModule", () => {
  it("declares AppController", () => {
    const controllers = getModuleMetadata(MODULE_METADATA.CONTROLLERS) ?? [];

    expect(controllers).toContain(AppController);
  });

  it("registers the expected imports", () => {
    const imports = getModuleMetadata(MODULE_METADATA.IMPORTS) ?? [];

    expect(imports.length).toBeGreaterThan(0);
  });
});
