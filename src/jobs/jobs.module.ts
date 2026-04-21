import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DynamoModule } from "../infrastructure/dynamo/dynamo.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";

@Module({
  imports: [AuthModule, DynamoModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
