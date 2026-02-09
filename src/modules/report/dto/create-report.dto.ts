import {
  IsString,
  IsUUID,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
  Matches,
  IsOptional,
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

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  tareWeight: number;

  @IsString()
  driverName: string;

  @ValidateNested({ each: true })
  @Type(() => CreateReportItemDto)
  //@ArrayMinSize(1)
  items: CreateReportItemDto[];
}
