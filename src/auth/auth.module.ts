import { Module } from "@nestjs/common";
import { RolesGuard } from "./guards/roles.guard";
import { CognitoAuthGuard } from "./guards/cognito-auth.guard";
import { UsersLookupService } from "./users-lookup.service";

@Module({
  providers: [CognitoAuthGuard, RolesGuard, UsersLookupService],
  exports: [CognitoAuthGuard, RolesGuard, UsersLookupService],
})
export class AuthModule {}
