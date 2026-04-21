import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { ChatModule } from "./chat/chat.module";
import { JobsModule } from "./jobs/jobs.module";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { S3Module } from "./infrastructure/storage/s3.module";
import { SupabaseModule } from "./infrastructure/supabase/supabase.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SupabaseModule,
    S3Module,
    ChatModule,
    JobsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
