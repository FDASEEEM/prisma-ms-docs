import { BadRequestException } from "@nestjs/common";
import { ChatController } from "../../src/chat/chat.controller";
import { ChatService } from "../../src/chat/chat.service";

jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(() => "jwks"),
  jwtVerify: jest.fn(),
}));

describe("ChatController additional cases", () => {
  const chatServiceMock = {
    startChat: jest.fn(),
  };

  let controller: ChatController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ChatController(chatServiceMock as unknown as ChatService);
  });

  it("rejects when material_file is missing", async () => {
    const paciFile = {
      originalname: "paci.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("paci"),
    };

    await expect(
      controller.startChat({ user: { id: "teacher-1" } } as any, { paci_file: [paciFile] }, { prompt: "hola" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(chatServiceMock.startChat).not.toHaveBeenCalled();
  });
});
