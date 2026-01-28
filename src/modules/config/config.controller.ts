import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getConfig() {
    return this.configService.getConfig();
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles('ROLE_ADMIN')
  updateConfig(@Body() updateConfigDto: UpdateConfigDto) {
    return this.configService.updateConfig(updateConfigDto);
  }
}
