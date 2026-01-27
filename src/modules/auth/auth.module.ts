import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/user.module';
import { RolesGuard } from './guards/roles.guard';

@Module({
    imports: [
        UsersModule, // 👈 necesario para UsersService
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (
                configService: ConfigService,
            ): Promise<JwtModuleOptions> => ({
                secret: configService.get<string>('JWT_SECRET')!,
                signOptions: {
                    expiresIn: Number(configService.get('JWT_EXPIRES_IN')),
                },
            }),
        }),
    ],
    providers: [
        AuthService,
        LocalStrategy,
        JwtStrategy,
        RolesGuard, // ✅ ACÁ
    ],
    controllers: [AuthController],
    exports: [
        AuthService,
        RolesGuard, // ✅ Y ACÁ
        UsersModule, // Exportar UsersModule para que otros módulos puedan usar UsersService con RolesGuard
    ],
})
export class AuthModule { }
