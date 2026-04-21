import { IsOptional, IsString, MaxLength } from "class-validator";

export class StartChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  school_id?: string;
}