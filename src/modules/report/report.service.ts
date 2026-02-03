import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportState, WeightUnit } from './entities/report.entity';
import { Product } from '../products/entities/product.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SystemConfig } from '../config/entities/config.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportItemDto } from './dto/create.item.report.dto';
import { ReportItem } from './entities/report.product.entity';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Report)
        private reportsRepository: Repository<Report>,
        @InjectRepository(ReportItem)
        private reportItemsRepository: Repository<ReportItem>,
        @InjectRepository(Product)
        private productsRepository: Repository<Product>,
        @InjectRepository(Supplier)
        private suppliersRepository: Repository<Supplier>,
        @InjectRepository(SystemConfig)
        private configRepository: Repository<SystemConfig>,
    ) { }


    /* =========================
     CONVERSIÓN A QUINTALES
  ========================= */

    private convertToQuintals(weight: number, unit: WeightUnit): number {
        const map = {
            [WeightUnit.QUINTALS]: 1,
            [WeightUnit.POUNDS]: 0.01,
            [WeightUnit.KILOGRAMS]: 0.02174,
            [WeightUnit.TONS]: 21.74,
        };

        return Number((weight * map[unit]).toFixed(4));
    }
    /* =========================
         TICKET CORRELATIVO
      ========================= */

    private async generateTicket(): Promise<string> {
        const last = await this.reportsRepository.find({
            order: { createdAt: 'DESC' },
            take: 1,
        });

        const lastNumber = last.length
            ? Number(last[0].ticketNumber)
            : 0;

        return String(lastNumber + 1).padStart(6, '0');
    }
    /* =========================
       CALCULO DE PRECIOS
    ========================= */

    private calculatePrices(
        pricePerQuintal: number,
        weightInQuintals: number,
        extraPercentage: number,
    ) {
        const basePrice = Number(
            (pricePerQuintal * weightInQuintals).toFixed(2),
        );

        const extraPrice = Number(
            (basePrice * (extraPercentage / 100)).toFixed(2),
        );

        const totalPrice = Number((basePrice + extraPrice).toFixed(2));

        return { basePrice, extraPrice, totalPrice };
    }

    /* =========================
       CREATE
    ========================= */

    async create(dto: CreateReportDto, userId: string) {
        const supplier = await this.suppliersRepository.findOne({
            where: { id: dto.supplierId },
        });
        if (!supplier) throw new NotFoundException('Proveedor no encontrado');

        const ticketNumber = await this.generateTicket();

        let netWeight = dto.grossWeight - dto.tareWeight;
        if (netWeight <= 0) {
            throw new ConflictException('Peso neto inválido');
        }

        // Aplicar extraPercentage del DTO si viene
        if (dto.extraPercentage && dto.extraPercentage > 0) {
            netWeight -= netWeight * (dto.extraPercentage / 100);
        }


        netWeight -= netWeight * 0.05;



        const report = this.reportsRepository.create({
            reportDate: dto.reportDate,
            plateNumber: dto.plateNumber,
            ticketNumber,
            supplier,
            userId,
            grossWeight: dto.grossWeight,
            tareWeight: dto.tareWeight,
            netWeight: Number(netWeight.toFixed(2)),
            extraPercentage: dto.extraPercentage || 0,
            basePrice: 0,
            totalPrice: 0,
            driverName: dto.driverName,
            state: ReportState.PENDING,
            items: [],
        });

        return this.reportsRepository.save(report);
    }



    /* =========================
       FIND ALL (PAGINADO + FILTROS)
    ========================= */

    async findAll(
        page = 1,
        pageSize = 10,
        startDate?: string,
        endDate?: string,
        supplierId?: string,
        productId?: string,
        search?: string,
    ) {
        const skip = (page - 1) * pageSize;

        const qb = this.reportsRepository
            .createQueryBuilder('report')
            .leftJoinAndSelect('report.supplier', 'supplier')
            .leftJoinAndSelect('report.user', 'user')
            .leftJoinAndSelect('report.items', 'items')
            .leftJoinAndSelect('items.product', 'itemProduct')
            .orderBy('report.reportDate', 'DESC')

        if (startDate && endDate) {
            qb.andWhere('report.reportDate BETWEEN :start AND :end', {
                start: startDate,
                end: endDate,
            });
        }

        if (supplierId) {
            qb.andWhere('report.supplierId = :supplierId', { supplierId });
        }

        if (productId) {
            qb.andWhere('itemProduct.id = :productId', { productId });
        }

        if (search) {
            qb.andWhere(
                `(report.plateNumber ILIKE :search
    OR report.ticketNumber ILIKE :search
    OR report.driverName ILIKE :search)`,
                { search: `%${search}%` },
            );
        }

        const [data, total] = await qb
            .skip(skip)
            .take(pageSize)
            .getManyAndCount();

        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    /* =========================
       FIND ONE
    ========================= */

    async findOne(id: string) {
        const report = await this.reportsRepository.findOne({
            where: { id },
            relations: ['supplier', 'user', 'items', 'items.product'],
        });

        if (!report) {
            throw new NotFoundException('Reporte no encontrado');
        }

        return report;
    }

    async addItem(reportId: string, dto: CreateReportItemDto) {
        const report = await this.findOne(reportId);

        if (report.state !== ReportState.PENDING) {
            throw new ConflictException('El reporte no se puede modificar');
        }

        const product = await this.productsRepository.findOne({
            where: { id: dto.productId },
        });
        if (!product) throw new NotFoundException('Producto no encontrado');

        let effectiveWeight = dto.weight;

        // Aplicar extraPercentage del reporte si existe
        if (report.extraPercentage && report.extraPercentage > 0) {
            effectiveWeight -= effectiveWeight * (report.extraPercentage / 100);
        }

        // Siempre restar el 5% adicional
        effectiveWeight -= effectiveWeight * 0.05;

        if (dto.discountWeight) {
            effectiveWeight -= dto.discountWeight;
        }

        if (effectiveWeight <= 0) {
            throw new ConflictException('Peso efectivo inválido');
        }

        const usedWeight = report.items.reduce(
            (sum, i) => sum + i.weight,
            0,
        );

        if (usedWeight + effectiveWeight > report.netWeight) {
            throw new ConflictException('Se excede el peso neto disponible');
        }

        const weightInQuintals = this.convertToQuintals(
            effectiveWeight,
            dto.weightUnit,
        );

        const basePrice = Number(
            (weightInQuintals * Number(product.pricePerQuintal)).toFixed(2),
        );

        report.items.push(
            this.reportItemsRepository.create({
                product,
                weight: effectiveWeight,
                weightUnit: dto.weightUnit,
                weightInQuintals,
                pricePerQuintal: product.pricePerQuintal,
                basePrice,
            }),
        );

        return this.reportsRepository.save(report);
    }

    async finish(id: string) {
        const report = await this.findOne(id);

        if (report.state !== ReportState.PENDING) {
            throw new ConflictException('El reporte no se puede finalizar');
        }

        const basePrice = report.items.reduce(
            (sum, i) => sum + i.basePrice,
            0,
        );

        report.basePrice = basePrice;
        report.totalPrice = basePrice;
        report.state = ReportState.APPROVED;

        return this.reportsRepository.save(report);
    }

    async cancel(id: string) {
        const report = await this.findOne(id);

        if (report.state === ReportState.CANCELLED) {
            throw new ConflictException('El reporte ya está cancelado');
        }

        report.state = ReportState.CANCELLED;
        return this.reportsRepository.save(report);
    }

    /**
     * Método para obtener el porcentaje configurado del sistema
     * @returns Porcentaje de configuración del sistema
     */
    private async getConfigPercentage(): Promise<number> {
        const config = await this.configRepository.findOne({
            order: { updatedAt: 'DESC' },
        });

        return config?.extraPercentage || 0;
    }



    /* =========================
        GENERAR PDF TICKET
     ========================= */

    async generatePdfTicket(id: string): Promise<Buffer> {
        const report = await this.findOne(id);

        // Crear un servidor temporal Express para generar el PDF
        const puppeteer = require('puppeteer');

        const html = this.generateTicketHtml(report);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        await browser.close();

        return pdfBuffer;
    }

    private generateTicketHtml(report: Report): string {
        const formatDate = (date: Date) => {
            return new Date(date).toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        const formatCurrency = (amount: number | string) => {
            return new Intl.NumberFormat('es-GT', {
                style: 'currency',
                currency: 'GTQ'
            }).format(Number(amount));
        };

        const formatWeight = (weight: number | string) => {
            return Number(weight).toFixed(2);
        };

        const itemsHtml = report.items.map(item => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.product.name}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${formatWeight(item.weight)} ${item.weightUnit}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${Number(item.weightInQuintals).toFixed(4)} qq</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.pricePerQuintal)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.basePrice)}</td>
            </tr>
        `).join('');

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>Ticket de Pesaje</title>
    <style>
        @page {
            margin: 12mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            color: #111827;
            background: #ffffff;
        }

        .ticket {
            max-width: 900px;
            margin: auto;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }

        /* ================= HEADER ================= */
        .header {
            background: #1f2937;
            color: #ffffff;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .company {
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 1px;
        }

        .ticket-meta {
            text-align: right;
            font-size: 12px;
        }

        .ticket-meta strong {
            display: block;
            font-size: 18px;
        }

        /* ================= CONTENT ================= */
        .content {
            padding: 24px;
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .pending { background: #fef3c7; color: #92400e; }
        .approved { background: #d1fae5; color: #065f46; }
        .cancelled { background: #fee2e2; color: #991b1b; }

        /* ================= INFO GRID ================= */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 24px;
        }

        .info-box {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px 12px;
        }

        .info-label {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 4px;
        }

        .info-value {
            font-size: 14px;
            font-weight: 600;
        }

        /* ================= WEIGHTS ================= */
        .weights {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 24px;
        }

        .weight-box {
            border: 2px solid #1f2937;
            border-radius: 6px;
            padding: 12px;
            text-align: center;
        }

        .weight-box span {
            display: block;
            font-size: 11px;
            color: #6b7280;
        }

        .weight-box strong {
            font-size: 20px;
        }

        /* ================= TABLE ================= */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }

        thead th {
            background: #f3f4f6;
            border-bottom: 2px solid #1f2937;
            padding: 8px;
            text-align: left;
            font-size: 12px;
        }

        tbody td {
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
        }

        .right { text-align: right; }
        .center { text-align: center; }

        /* ================= TOTALS ================= */
        .totals {
            max-width: 350px;
            margin-left: auto;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 16px;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .grand-total {
            border-top: 2px solid #1f2937;
            padding-top: 10px;
            margin-top: 10px;
            font-size: 18px;
            font-weight: bold;
        }

        /* ================= FOOTER ================= */
        .footer {
            text-align: center;
            font-size: 11px;
            color: #6b7280;
            padding: 16px;
            border-top: 1px dashed #e5e7eb;
        }
    </style>
</head>
<body>

<div class="ticket">
    <div class="header">
        <div class="company">RECIGUA</div>
        <div class="ticket-meta">
            Ticket #
            <strong>${report.ticketNumber}</strong>
            ${formatDate(report.reportDate)}
        </div>
    </div>

    <div class="content">

        <div class="info-grid">
            <div class="info-box">
                <div class="info-label">Estado</div>
                <div class="info-value">
                    <span class="badge ${report.state.toLowerCase()}">
                        ${report.state === ReportState.PENDING ? 'Pendiente' :
                report.state === ReportState.APPROVED ? 'Aprobado' : 'Cancelado'}
                    </span>
                </div>
            </div>

            <div class="info-box">
                <div class="info-label">Proveedor</div>
                <div class="info-value">${report.supplier.name}</div>
            </div>

            <div class="info-box">
                <div class="info-label">Conductor</div>
                <div class="info-value">${report.driverName}</div>
            </div>

            <div class="info-box">
                <div class="info-label">Placa</div>
                <div class="info-value">${report.plateNumber}</div>
            </div>

            <div class="info-box">
                <div class="info-label">Usuario</div>
                <div class="info-value">${report.user?.firstName || 'N/A'}</div>
            </div>
        </div>

        <div class="weights">
            <div class="weight-box">
                <span>Peso Bruto</span>
                <strong>${formatWeight(report.grossWeight)} lb</strong>
            </div>
            <div class="weight-box">
                <span>Tara</span>
                <strong>${formatWeight(report.tareWeight)} lb</strong>
            </div>
            <div class="weight-box">
                <span>Peso Neto</span>
                <strong>${formatWeight(report.netWeight)} lb</strong>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Producto</th>
                    <th class="center">Peso</th>
                    <th class="center">Quintales</th>
                    <th class="right">Precio / qq</th>
                    <th class="right">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="totals">
            <div class="total-row">
                <span>Total Base</span>
                <span>${formatCurrency(report.basePrice)}</span>
            </div>
            <div class="total-row grand-total">
                <span>TOTAL A PAGAR</span>
                <span>${formatCurrency(report.totalPrice)}</span>
            </div>
        </div>

    </div>

    <div class="footer">
        Generado el ${formatDate(report.reportDate)}· Documento oficial de pesaje
    </div>
</div>

</body>
</html>
`;

    }
    /* =========================
       GENERAR EXCEL DE REPORTES
    ========================= */

    async generateExcelReports(
        startDate?: string,
        endDate?: string,
        supplierId?: string,
        productId?: string,
        search?: string,
    ): Promise<Buffer> {
        // Obtener todos los reportes con los filtros (sin paginación)
        const qb = this.reportsRepository
            .createQueryBuilder('report')
            .leftJoinAndSelect('report.supplier', 'supplier')
            .leftJoinAndSelect('report.user', 'user')
            .leftJoinAndSelect('report.items', 'items')
            .leftJoinAndSelect('items.product', 'itemProduct')
            .orderBy('report.reportDate', 'DESC');

        if (startDate && endDate) {
            qb.andWhere('report.reportDate BETWEEN :start AND :end', {
                start: startDate,
                end: endDate,
            });
        }

        if (supplierId) {
            qb.andWhere('report.supplierId = :supplierId', { supplierId });
        }

        if (productId) {
            qb.andWhere('itemProduct.id = :productId', { productId });
        }

        if (search) {
            qb.andWhere(
                `(report.plateNumber ILIKE :search
                OR report.ticketNumber ILIKE :search
                OR report.driverName ILIKE :search)`,
                { search: `%${search}%` },
            );
        }

        const reports = await qb.getMany();

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reportes');

        // Configurar el ancho de las columnas
        worksheet.columns = [
            { header: 'No. Ticket', key: 'ticketNumber', width: 15 },
            { header: 'Fecha', key: 'reportDate', width: 15 },
            { header: 'Placa', key: 'plateNumber', width: 12 },
            { header: 'Conductor', key: 'driverName', width: 25 },
            { header: 'Proveedor', key: 'supplierName', width: 30 },
            { header: 'Peso Bruto (lb)', key: 'grossWeight', width: 15 },
            { header: 'Tara (lb)', key: 'tareWeight', width: 15 },
            { header: 'Peso Neto (lb)', key: 'netWeight', width: 15 },
            { header: 'Producto', key: 'productName', width: 30 },
            { header: 'Peso Item', key: 'itemWeight', width: 15 },
            { header: 'Unidad', key: 'weightUnit', width: 12 },
            { header: 'Quintales', key: 'quintals', width: 15 },
            { header: 'Precio/qq', key: 'pricePerQuintal', width: 15 },
            { header: 'Subtotal', key: 'itemTotal', width: 15 },
            { header: 'Total Reporte', key: 'totalPrice', width: 15 },
            { header: 'Estado', key: 'state', width: 12 },
            { header: 'Usuario', key: 'userName', width: 25 },
        ];

        // Estilo del encabezado
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF667EEA' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;

        // Agregar los datos
        reports.forEach(report => {
            if (report.items.length === 0) {
                // Si no tiene items, agregar una fila con la info del reporte
                worksheet.addRow({
                    ticketNumber: report.ticketNumber,
                    reportDate: new Date(report.reportDate).toLocaleDateString('es-GT'),
                    plateNumber: report.plateNumber,
                    driverName: report.driverName,
                    supplierName: report.supplier.name,
                    grossWeight: Number(report.grossWeight),
                    tareWeight: Number(report.tareWeight),
                    netWeight: Number(report.netWeight),
                    productName: 'Sin productos',
                    itemWeight: 0,
                    weightUnit: '-',
                    quintals: 0,
                    pricePerQuintal: 0,
                    itemTotal: 0,
                    totalPrice: Number(report.totalPrice),
                    state: report.state === ReportState.PENDING ? 'Pendiente' :
                        report.state === ReportState.APPROVED ? 'Aprobado' : 'Cancelado',
                    userName: report.user?.firstName || 'N/A',
                });
            } else {
                // Por cada item del reporte, agregar una fila
                report.items.forEach((item, index) => {
                    worksheet.addRow({
                        ticketNumber: index === 0 ? report.ticketNumber : '',
                        reportDate: index === 0 ? new Date(report.reportDate).toLocaleDateString('es-GT') : '',
                        plateNumber: index === 0 ? report.plateNumber : '',
                        driverName: index === 0 ? report.driverName : '',
                        supplierName: index === 0 ? report.supplier.name : '',
                        grossWeight: index === 0 ? Number(report.grossWeight) : '',
                        tareWeight: index === 0 ? Number(report.tareWeight) : '',
                        netWeight: index === 0 ? Number(report.netWeight) : '',
                        productName: item.product.name,
                        itemWeight: Number(item.weight),
                        weightUnit: item.weightUnit,
                        quintals: Number(item.weightInQuintals),
                        pricePerQuintal: Number(item.pricePerQuintal),
                        itemTotal: Number(item.basePrice),
                        totalPrice: index === 0 ? Number(report.totalPrice) : '',
                        state: index === 0 ? (report.state === ReportState.PENDING ? 'Pendiente' :
                            report.state === ReportState.APPROVED ? 'Aprobado' : 'Cancelado') : '',
                        userName: index === 0 ? (report.user?.firstName || 'N/A') : '',
                    });
                });
            }
        });

        // Aplicar formato a las columnas numéricas
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                // Formato de números
                ['F', 'G', 'H', 'J', 'L', 'M', 'N', 'O'].forEach(col => {
                    const cell = row.getCell(col);
                    if (cell.value) {
                        cell.numFmt = '#,##0.00';
                    }
                });

                // Alineación
                row.eachCell(cell => {
                    cell.alignment = { vertical: 'middle' };
                });
            }
        });

        // Bordes para todas las celdas
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Generar el buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }


}
