import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
/* import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { ProductosModule } from './modules/productos/productos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { ConfigModuleApp } from './modules/config/config.module';
 */
@Module({
  imports: [
    // Configuración de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuración de TypeORM con PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: +configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USER'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Usar migraciones en producción
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Módulos de la aplicación
    /* AuthModule,
    UsersModule,
    RolesModule,
    ProveedoresModule,
    ProductosModule,
    ReportesModule,
    ConfigModuleApp, */
  ],
})
export class AppModule {}