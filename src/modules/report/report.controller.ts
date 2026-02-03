import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Patch,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReportsService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportItemDto } from './dto/create.item.report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Crear un nuevo reporte
   */
  @Post()
  create(@Body() createReportDto: CreateReportDto, @Request() req) {
    return this.reportsService.create(createReportDto, req.user.userId);
  }

  /**
   * Obtener todos los reportes con paginación y filtros
   */
  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('supplierId') supplierId?: string,
    @Query('productId') productId?: string,
    @Query('search') search?: string,
  ) {
    return this.reportsService.findAll(
      page,
      pageSize,
      startDate,
      endDate,
      supplierId,
      productId,
      search,
    );
  }

  /**
   * Obtener un reporte por ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  /**
   * Agregar un producto al reporte
   */
  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() createReportItemDto: CreateReportItemDto,
  ) {
    return this.reportsService.addItem(id, createReportItemDto);
  }

  /**
   * Finalizar un reporte (cambiar estado y calcular totales)
   */
  @Patch(':id/finish')
  finish(@Param('id') id: string) {
    return this.reportsService.finish(id);
  }

  /**
   * Cancelar un reporte
   */
  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('ROLE_ADMIN')
  cancel(@Param('id') id: string) {
    return this.reportsService.cancel(id);
  }
}
