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
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportItemDto } from './dto/create.item.report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

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
  finish(@Param('id') id: string, @Body('tareWeight') tareWeight: number) {
    return this.reportsService.finish(id, tareWeight);
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

  /**
     * Generar PDF del ticket de un reporte
     */
  @Get(':id/pdf')
  async generatePdfTicket(@Param('id') id: string,  @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generatePdfTicket(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ticket-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }


  /**
  * Generar Excel con todos los reportes filtrados
  * IMPORTANTE: Esta ruta debe estar ANTES de la ruta :id
  */
  @Get('export/excel')
  async exportToExcel(
    @Res({ passthrough: false }) res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('supplierId') supplierId?: string,
    @Query('productId') productId?: string,
    @Query('search') search?: string,
  ) {
    const excelBuffer = await this.reportsService.generateExcelReports(
      startDate,
      endDate,
      supplierId,
      productId,
      search,
    );

    const filename = `reportes-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    res.end(excelBuffer);
  }




}
