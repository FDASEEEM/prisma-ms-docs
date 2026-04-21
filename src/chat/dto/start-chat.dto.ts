import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class StartChatDto {
  @ApiPropertyOptional({
    description: "Texto opcional para contextualizar la sesión.",
    example: "Necesito resumir la planificación del periodo.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prompt?: string;

  @ApiPropertyOptional({
    description: "Identificador del colegio.",
    example: "colegio_demo",
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  school_id?: string;
}