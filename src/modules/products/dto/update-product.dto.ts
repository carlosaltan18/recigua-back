import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerQuintal?: number;
}