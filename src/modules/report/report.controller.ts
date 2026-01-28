import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportesService: ReportsService) {}

  @Post()
  create(@Body() createReportDto: CreateReportDto, @Request() req) {
    return this.reportesService.create(createReportDto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('proveedorId') proveedorId?: string,
    @Query('productoId') productoId?: string,
    @Query('search') search?: string,
  ) {
    return this.reportesService.findAll(
      page,
      pageSize,
      fechaInicio,
      fechaFin,
      proveedorId,
      productoId,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto) {
    return this.reportesService.update(id, updateReportDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ROLE_ADMIN')
  remove(@Param('id') id: string) {
    return this.reportesService.remove(id);
  }
}
