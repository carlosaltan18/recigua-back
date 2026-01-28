import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { Product } from '../products/entities/product.entity';
import { SystemConfig } from '../config/entities/config.entity';
import { ReportsService } from './report.service';
import { ReportsController } from './report.controller';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { AuthModule } from '../auth/auth.module';


@Module({
  imports: [TypeOrmModule.forFeature([Report, Product, SystemConfig, Supplier]), AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportModule {}