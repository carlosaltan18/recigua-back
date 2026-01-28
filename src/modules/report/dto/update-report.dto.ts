import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, IsUUID, Min } from 'class-validator';
import { WeightUnit } from '../entities/report.entity';

export class UpdateReportDto {
  @IsDateString()
  @IsOptional()
  reportDate?: Date;

  @IsString()
  @IsOptional()
  plateNumber?: string;

  @IsString()
  @IsOptional()
  ticketNumber?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  weight?: number;

  @IsEnum(WeightUnit)
  @IsOptional()
  weightUnit?: WeightUnit;

  @IsString()
  @IsOptional()
  driverName?: string;
}
