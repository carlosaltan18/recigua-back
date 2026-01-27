import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../users/user.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = await this.usersService.findOne(request.user.userId);

    const hasRole = user.roles.some((role) => requiredRoles.includes(role.name));
    
    if (!hasRole) {
      throw new ForbiddenException('No tiene permisos para esta acción');
    }

    return true;
  }
}
