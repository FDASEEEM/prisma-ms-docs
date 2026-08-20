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
export class CognitoAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoAuthGuard.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>("COGNITO_REGION") || "us-east-1";
    const userPoolId = this.configService.getOrThrow<string>("COGNITO_USER_POOL_ID");
    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
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
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer });
      const custom = (payload["custom"] ?? {}) as Record<string, unknown>;
      request.user = {
        id: payload.sub,
        email: payload["email"],
        role: payload["cognito:roles"] ?? custom["role"],
        appRole: typeof custom["role"] === "string" ? custom["role"] : undefined,
        colegioId:
          typeof custom["colegioId"] === "string" ? custom["colegioId"] : null,
      };
      return true;
    } catch (err) {
      this.logger.error(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }
}
