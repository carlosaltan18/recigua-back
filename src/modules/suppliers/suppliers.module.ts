import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SuppliersController } from './supplier.controller';
import { SuppliersService } from './supplier.service';
import { AuthModule } from '../auth/auth.module';


@Module({
  imports: [TypeOrmModule.forFeature([Supplier]),
  AuthModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],

})
export class SuppliersModule { }