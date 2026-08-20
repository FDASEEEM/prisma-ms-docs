import { Module } from "@nestjs/common";
import { RolesGuard } from "./guards/roles.guard";
import { CognitoAuthGuard } from "./guards/supabase-auth.guard";

@Module({
  providers: [CognitoAuthGuard, RolesGuard],
  exports: [CognitoAuthGuard, RolesGuard],
})
export class AuthModule {}
