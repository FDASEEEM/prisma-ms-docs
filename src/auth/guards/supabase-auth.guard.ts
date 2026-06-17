import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Request } from "express";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>("SUPABASE_URL");
    this.jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException("Authorization header is required.");
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Invalid Authorization header.");
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        audience: "authenticated",
      });
      const appMetadata = (payload["app_metadata"] ?? {}) as Record<string, unknown>;
      request.user = {
        id: payload.sub,
        email: payload["email"],
        role: payload["role"],
        appRole: typeof appMetadata["role"] === "string" ? appMetadata["role"] : undefined,
        colegioId:
          typeof appMetadata["colegioId"] === "string" ? appMetadata["colegioId"] : null,
      };
      return true;
    } catch (err) {
      this.logger.error(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }
}
