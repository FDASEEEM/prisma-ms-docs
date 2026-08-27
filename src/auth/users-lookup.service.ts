import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ResolvedAuthz {
  role?: string;
  colegioId: string | null;
  email?: string;
}

interface CacheEntry {
  value: ResolvedAuthz;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 5_000;

/**
 * Resuelve rol y colegioId del usuario contra `prisma-ms-users`.
 *
 * El access token de Cognito no incluye los atributos `custom:*` ni `email`
 * (solo `sub`), así que cuando esos datos no vienen en el token los pedimos a
 * ms-users (`GET /api/auth/me`) y cacheamos por `sub` unos segundos para no
 * pegar un request por cada llamada.
 */
@Injectable()
export class UsersLookupService {
  private readonly logger = new Logger(UsersLookupService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<ResolvedAuthz>>();

  constructor(private readonly configService: ConfigService) {}

  async resolve(sub: string, token: string): Promise<ResolvedAuthz> {
    const cached = this.cache.get(sub);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Deduplica ráfagas concurrentes (varias requests del mismo usuario a la vez)
    // en una sola llamada a ms-users, para no agotar el pool de conexiones.
    const inFlight = this.pending.get(sub);
    if (inFlight) return inFlight;

    const promise = this.fetchAndCache(sub, token).finally(() => {
      this.pending.delete(sub);
    });
    this.pending.set(sub, promise);
    return promise;
  }

  private async fetchAndCache(sub: string, token: string): Promise<ResolvedAuthz> {
    const baseUrl = this.configService.get<string>("USERS_SERVICE_URL");
    if (!baseUrl) {
      this.logger.warn(
        "USERS_SERVICE_URL no está configurado; no se puede resolver rol/colegioId.",
      );
      return { colegioId: null };
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      this.logger.error(
        `users-service inalcanzable: ${(err as Error).message}`,
      );
      return { colegioId: null };
    }

    if (response.status === 401) {
      throw new UnauthorizedException("Invalid or expired token.");
    }
    if (!response.ok) {
      this.logger.error(`users-service /api/auth/me devolvió ${response.status}`);
      return { colegioId: null };
    }

    const profile = (await response.json()) as {
      email?: string;
      role?: string;
      colegioId?: string | null;
    };

    const value: ResolvedAuthz = {
      role: profile.role,
      colegioId: profile.colegioId ?? null,
      email: profile.email,
    };

    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      this.cache.clear();
    }
    this.cache.set(sub, { value, expiresAt: Date.now() + CACHE_TTL_MS });

    return value;
  }
}
