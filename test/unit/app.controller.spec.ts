import { AppController } from "../../src/app.controller";

describe("AppController", () => {
  it("returns the health payload", () => {
    const controller = new AppController();

    expect(controller.health()).toEqual({ status: "ok" });
  });
});
