import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { SystemConfig } from './entities/config.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig]), AuthModule],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModuleApp {}