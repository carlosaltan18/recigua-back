import {
  IsString,
  IsUUID,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateReportItemDto } from './create.item.report.dto';

export class CreateReportDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'reportDate debe estar en formato YYYY-MM-DD' })
  reportDate: string;

  @IsString()
  plateNumber: string;

  @IsUUID()
  supplierId: string;

  @IsNumber()
  @Min(0.01)
  grossWeight: number;

  @IsNumber()
  @Min(0.01)
  tareWeight: number;

  @IsString()
  driverName: string;

  @IsNumber()
  @Min(0)
  extraPercentage: number;

  @ValidateNested({ each: true })
  @Type(() => CreateReportItemDto)
  @ArrayMinSize(1)
  items: CreateReportItemDto[];
}
