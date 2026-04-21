import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { StartChatDto } from "./dto/start-chat.dto";
import { ChatService } from "./chat.service";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@ApiTags("chat")
@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("start")
  @HttpCode(201)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Iniciar sesión de chat PACI" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        paci_file: { type: "string", format: "binary" },
        material_file: { type: "string", format: "binary" },
        prompt: { type: "string", description: "Texto opcional" },
        school_id: {
          type: "string",
          default: "colegio_demo",
          description: "Identificador del colegio",
        },
      },
      required: ["paci_file", "material_file"],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "paci_file", maxCount: 1 },
        { name: "material_file", maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 25 * 1024 * 1024,
        },
      },
    ),
  )
  @ApiResponse({ status: 201, description: "Sesión creada correctamente." })
  async startChat(
    @UploadedFiles()
    files: {
      paci_file?: UploadedFile[];
      material_file?: UploadedFile[];
    },
    @Body() dto: StartChatDto,
  ): Promise<{ session_id: string }> {
    const paciFile = files.paci_file?.[0];
    const materialFile = files.material_file?.[0];

    if (!paciFile || !materialFile) {
      throw new BadRequestException("paci_file and material_file are required.");
    }

    return this.chatService.startChat({
      paciFile,
      materialFile,
      prompt: dto.prompt ?? "",
      schoolId: dto.school_id ?? "colegio_demo",
    });
  }
}