import { IsNotEmpty, IsString, IsNumber, IsEnum, IsDateString, IsUUID, Min } from 'class-validator';
import { WeightUnit } from '../entities/report.entity';

export class CreateReportDto {
  @IsDateString()
  @IsNotEmpty()
  reportDate: Date;

  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @IsString()
  @IsNotEmpty()
  ticketNumber: string;

  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  weight: number;

  @IsEnum(WeightUnit)
  weightUnit: WeightUnit;

  @IsString()
  @IsNotEmpty()
  driverName: string;
}
