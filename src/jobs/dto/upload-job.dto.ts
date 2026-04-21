import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UploadJobDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  paciJson?: string;
}
