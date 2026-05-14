import { BadRequestException } from "@nestjs/common";
import { ChatController } from "../../src/chat/chat.controller";
import { ChatService } from "../../src/chat/chat.service";

describe("ChatController", () => {
  const chatServiceMock = {
    startChat: jest.fn(),
  };

  let controller: ChatController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ChatController(chatServiceMock as unknown as ChatService);
  });

  it("uses defaults when dto omits prompt and school", async () => {
    chatServiceMock.startChat.mockResolvedValue({ session_id: "session-1" });

    const paciFile = {
      originalname: "paci.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("paci"),
    };
    const materialFile = {
      originalname: "material.docx",
      mimetype:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("material"),
    };

    await expect(
      controller.startChat(
        { paci_file: [paciFile], material_file: [materialFile] },
        {},
      ),
    ).resolves.toEqual({ session_id: "session-1" });

    expect(chatServiceMock.startChat).toHaveBeenCalledWith({
      paciFile,
      materialFile,
      prompt: "",
      schoolId: "colegio_demo",
    });
  });

  it("rejects when paci_file is missing", async () => {
    await expect(
      controller.startChat({ material_file: [] }, { prompt: "hola" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
