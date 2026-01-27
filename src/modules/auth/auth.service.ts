import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/user.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { email: user.email, sub: user.id };
    
    return {
      user: {
        id: user.id,
        nombre: user.firstName,
        apellido: user.lastName,
        email: user.email,
        roles: user.roles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token: this.jwtService.sign(payload),
    };
  }

  async getProfile(userId: string) {
    return this.usersService.findOne(userId);
  }
}
