import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { role?: string; appRole?: string } }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Authenticated user is required.");
    }

    const userRole = user.appRole ?? user.role;

    if (!userRole) {
      throw new ForbiddenException("User role is missing in token.");
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Role '${userRole}' is not authorized. Required: ${requiredRoles.join(", ")}.`,
      );
    }

    return true;
  }
}
