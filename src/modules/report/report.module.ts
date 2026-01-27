import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { Product } from '../products/entities/product.entity';
import { SystemConfig } from '../config/entities/config.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Report, Product, SystemConfig])],
})
export class ReportModule {}