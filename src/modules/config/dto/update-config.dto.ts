import { IsNumber, Min, Max } from 'class-validator';

export class UpdateConfigDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  extraPercentage: number;
}