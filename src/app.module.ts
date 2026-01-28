import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/user.module';
import { RolesModule } from './modules/roles/roles.module';
import { ReportModule } from './modules/report/report.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ProductModule } from './modules/products/product.module';
import { ConfigModuleApp } from './modules/config/config.module';


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
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: +configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USER'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),

        autoLoadEntities: true,

        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),


    // Módulos de la aplicación
    AuthModule,
    UsersModule,
    RolesModule,
    ReportModule,
    SuppliersModule,
    ProductModule,
    ConfigModuleApp,
    
  ],
})
export class AppModule { }