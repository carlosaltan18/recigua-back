import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './entities/config.entity';
import { UpdateConfigDto } from './dto/update-config.dto';

@Injectable()
export class ConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private configRepository: Repository<SystemConfig>,
  ) {}

  async getConfig() {
    let config = await this.configRepository.findOne({ where: {} });

    // Si no existe configuración, crear una por defecto
    if (!config) {
      config = this.configRepository.create({ extraPercentage: 5.0 });
      await this.configRepository.save(config);
    }

    return config;
  }

  async updateConfig(updateConfigDto: UpdateConfigDto) {
    let config = await this.configRepository.findOne({ where: {} });

    if (!config) {
      config = this.configRepository.create(updateConfigDto);
    } else {
      Object.assign(config, updateConfigDto);
    }

    return this.configRepository.save(config);
  }
}