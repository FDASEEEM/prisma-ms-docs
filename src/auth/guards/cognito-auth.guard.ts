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
import { UsersLookupService } from "../users-lookup.service";

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoAuthGuard.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersLookup: UsersLookupService,
  ) {
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

    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer }));
    } catch (err) {
      this.logger.error(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException("Invalid or expired token.");
    }

    const sub = payload.sub as string;

    // Cognito publica los atributos custom como claims planos (`custom:role`),
    // no como un objeto anidado. En el access token normalmente NO vienen, así
    // que si falta el rol lo resolvemos contra ms-users.
    const claimRole =
      typeof payload["custom:role"] === "string"
        ? (payload["custom:role"] as string)
        : undefined;
    const claimColegioId =
      typeof payload["custom:colegioId"] === "string"
        ? (payload["custom:colegioId"] as string)
        : undefined;

    let role = claimRole;
    let colegioId: string | null = claimColegioId ?? null;
    let email =
      typeof payload["email"] === "string"
        ? (payload["email"] as string)
        : undefined;

    if (!role) {
      const authz = await this.usersLookup.resolve(sub, token);
      role = authz.role;
      colegioId = authz.colegioId;
      email = email ?? authz.email;
    }

    request.user = {
      id: sub,
      email,
      role,
      appRole: role,
      colegioId,
    };

    return true;
  }
}
