import { IsArray, IsString } from 'class-validator';

export class ChangeRoleDto {
  @IsArray()
  @IsString({ each: true })
  roleNames: string[];
}
