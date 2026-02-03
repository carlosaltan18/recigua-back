import { IsUUID, IsNumber, IsEnum, Min, IsOptional } from 'class-validator';
import { WeightUnit } from '../entities/report.entity';

export class CreateReportItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.01)
  weight: number;

  @IsEnum(WeightUnit)
  weightUnit: WeightUnit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountWeight?: number; // descuento adicional en peso
}
