import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { ListJobsQueryDto } from "./dto/list-jobs-query.dto";
import { UploadJobDto } from "./dto/upload-job.dto";
import { JobsService } from "./jobs.service";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type RequestWithUser = Request & { user?: { id?: string } };

@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post("upload")
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Crear job PACI y subir archivos a S3" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        paciJson: { type: "string", description: "JSON del formulario UI web" },
        paciFile: { type: "string", format: "binary" },
        planningFile: { type: "string", format: "binary" },
      },
      required: ["prompt", "planningFile"],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "paciFile", maxCount: 1 },
        { name: "planningFile", maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 25 * 1024 * 1024,
        },
      },
    ),
  )
  @ApiResponse({ status: 201, description: "Job creado correctamente." })
  async upload(
    @Req() request: RequestWithUser,
    @Body() dto: UploadJobDto,
    @UploadedFiles()
    files: {
      paciFile?: UploadedFile[];
      planningFile?: UploadedFile[];
    },
  ) {
    const user = request.user;

    if (!user?.id) {
      throw new BadRequestException("Authenticated user is required.");
    }

    return this.jobsService.createUploadJob(user.id, dto, files);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Historial paginado de jobs del docente" })
  @ApiResponse({ status: 200, description: "Historial obtenido correctamente." })
  async findAll(@Req() request: RequestWithUser, @Query() query: ListJobsQueryDto) {
    const user = request.user;

    if (!user?.id) {
      throw new BadRequestException("Authenticated user is required.");
    }

    return this.jobsService.findJobsByUser(user.id, query);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Estado actual de un job" })
  @ApiResponse({ status: 200, description: "Estado obtenido correctamente." })
  async findOne(
    @Req() request: RequestWithUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    const user = request.user;

    if (!user?.id) {
      throw new BadRequestException("Authenticated user is required.");
    }

    return this.jobsService.findJobStatus(user.id, id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(":id/download")
  @ApiBearerAuth()
  @ApiOperation({ summary: "URL firmada para descargar el documento generado" })
  @ApiResponse({ status: 200, description: "URL generada correctamente." })
  async download(
    @Req() request: RequestWithUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    const user = request.user;

    if (!user?.id) {
      throw new BadRequestException("Authenticated user is required.");
    }

    return this.jobsService.getDownloadUrl(user.id, id);
  }
}
