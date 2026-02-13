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
        const LB_PER_KG = 2.20462262;
        const KG_PER_QUINTAL = 100; // 1 qq = 100 kg
        const LB_PER_QUINTAL = 220.462262; // más exacto

        let quintals: number;

        switch (unit) {
            case WeightUnit.QUINTALS:
                quintals = weight;
                break;

            case WeightUnit.KILOGRAMS:
                quintals = weight / KG_PER_QUINTAL;
                break;

            case WeightUnit.POUNDS:
                quintals = weight / LB_PER_QUINTAL;
                break;

            case WeightUnit.TONS:
                // 1 tonelada métrica = 1000 kg = 10 qq
                quintals = weight * 10;
                break;

            default:
                throw new Error(`Unidad no soportada: ${unit}`);
        }

        return Number(quintals);
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
        if (!supplier) {
            throw new NotFoundException('Proveedor no encontrado');
        }

        if (dto.grossWeight <= 0) {
            throw new ConflictException('Peso bruto inválido');
        }

        const ticketNumber = await this.generateTicket();

        const report = this.reportsRepository.create({
            reportDate: dto.reportDate,
            plateNumber: dto.plateNumber,
            ticketNumber,
            supplier,
            userId,
            // SOLO se guarda el bruto
            grossWeight: dto.grossWeight,
            // Aún no calculados
            tareWeight: 0,
            netWeight: 0,
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
            .distinct(true)
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

    /* =========================
       ADD ITEM
    ========================= */

    async addItem(reportId: string, dto: CreateReportItemDto) {
        const report = await this.findOne(reportId);

        if (report.state !== ReportState.PENDING) {
            throw new ConflictException('El reporte no se puede modificar');
        }

        const product = await this.productsRepository.findOne({
            where: { id: dto.productId },
        });
        if (!product) throw new NotFoundException('Producto no encontrado');

        // 1. Convertir el peso de entrada a Quintales inmediatamente
        // Esto asegura que la comparación contra el peso bruto sea precisa
        const weightInQuintalsRaw = this.convertToQuintals(dto.weight, dto.weightUnit);

        // 2. Aplicar deducciones sobre el peso en quintales
        let effectiveWeightInQuintals = weightInQuintalsRaw;

        // Restar el 5% fijo de humedad/impurezas
        effectiveWeightInQuintals -= effectiveWeightInQuintals * 0.05;

        // Aplicar descuento porcentual adicional si existe
        if (dto.discountWeight && dto.discountWeight > 0) {
            effectiveWeightInQuintals -= effectiveWeightInQuintals * (dto.discountWeight / 100);
        }

        if (effectiveWeightInQuintals <= 0) {
            throw new ConflictException('Peso efectivo inválido tras descuentos');
        }

        // 3. Validar contra el Peso Bruto del reporte (asumiendo que grossWeight está en quintales)
        const currentUsedWeight = report.items.reduce(
            (sum, i) => sum + i.weightInQuintals,
            0,
        );

        if (currentUsedWeight + effectiveWeightInQuintals > report.grossWeight) {
            console.log('Peso bruto:', report.grossWeight);
            console.log('Peso actual usado:', currentUsedWeight);
            console.log('Peso a agregar (en quintales):', effectiveWeightInQuintals);
            throw new ConflictException('Se excede el peso bruto disponible en el camión');
        }

        // 4. Calcular precio final
        const basePrice = Number(
            (effectiveWeightInQuintals * Number(product.pricePerQuintal)).toFixed(2),
        );

        report.items.push(
            this.reportItemsRepository.create({
                product,
                weight: Number(effectiveWeightInQuintals.toFixed(2)),
                weightUnit: WeightUnit.QUINTALS,
                weightInQuintals: effectiveWeightInQuintals,
                pricePerQuintal: product.pricePerQuintal,
                basePrice,
            }),
        );

        return this.reportsRepository.save(report);
    }

    async finish(id: string, tareWeight: number) {
        const report = await this.findOne(id);

        if (report.state !== ReportState.PENDING) {
            throw new ConflictException('El reporte no se puede finalizar');
        }

        if (!tareWeight || tareWeight <= 0) {
            throw new ConflictException('La tara es obligatoria y debe ser mayor a 0');
        }

        if (tareWeight >= report.grossWeight) {
            throw new ConflictException(
                'La tara no puede ser mayor o igual al peso bruto',
            );
        }

        let netWeight = report.grossWeight - tareWeight;

        // 4️⃣ Validar que los items cuadren con el neto BASE
        const totalItemsWeight = report.items.reduce(
            (sum, item) => sum + Number(item.weight),
            0,
        );

        if (Number(totalItemsWeight.toFixed(2)) > Number(netWeight.toFixed(2))) {
            throw new ConflictException(
                `La suma de los productos (${totalItemsWeight.toFixed(
                    2,
                )}) es superior al peso neto (${netWeight.toFixed(2)})`,
            );
        }

        netWeight = Number(netWeight.toFixed(2));

        // Recalcular precios por item
        let basePrice = 0;

        for (const item of report.items) {
            const weightInQuintals = this.convertToQuintals(
                item.weight,
                item.weightUnit,
            );

            item.weightInQuintals = weightInQuintals;

            item.basePrice = Number(
                (weightInQuintals * Number(item.pricePerQuintal)).toFixed(2),
            );

            basePrice += item.basePrice;
        }
        report.tareWeight = tareWeight;
        report.netWeight = netWeight;
        report.basePrice = Number(basePrice.toFixed(2));
        report.totalPrice = report.basePrice;
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
        const puppeteer = require('puppeteer');

        // Generamos el HTML combinando un ticket por cada item
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
                top: '10px',
                right: '20px',
                bottom: '10px',
                left: '20px'
            }
        });

        await browser.close();
        return pdfBuffer;
    }

    private generateTicketHtml(report: Report): string {
        const formatDate = (date: Date) => {
            return new Date(date).toLocaleDateString('es-GT', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        };

        const formatCurrency = (amount: number | string) => {
            return new Intl.NumberFormat('es-GT', {
                style: 'currency', currency: 'GTQ'
            }).format(Number(amount));
        };

        const formatWeight = (weight:    number | string) => Number(weight).toFixed(2);

        // Generamos un bloque HTML por cada producto
        const ticketsHtml = report.items.map((item, index) => {
            const isLast = index === report.items.length - 1;

            return `
        <div class="ticket" style="${!isLast ? 'page-break-after: always;' : ''}">
            <div class="header">
                <div class="company">RECIGUA</div>
                <div class="ticket-meta">
                    Ticket # <strong>${report.ticketNumber}</strong>
                    Item: ${index + 1} de ${report.items.length}<br>
                    ${formatDate(report.reportDate)}
                </div>
            </div>

            <div class="content">
                <h3 style="border-bottom: 2px solid #1f2937; padding-bottom: 5px;">Detalle del Producto</h3>
                
                <div class="product-detail">
                    <table style="width: 100%; font-size: 16px;">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th class="center">Peso Neto Item</th>
                                <th class="center">Quintales</th>
                                <th class="right">Precio/qq</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="font-size: 18px; font-weight: bold;">${item.product.name}</td>
                                <td class="center">${formatWeight(item.weight)} ${item.weightUnit}</td>
                                <td class="center">${Number(item.weightInQuintals).toFixed(4)} qq</td>
                                <td class="right">${formatCurrency(item.pricePerQuintal)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="totals" style="margin-top: 30px;">
                    <div class="total-row grand-total">
                        <span>SUBTOTAL PRODUCTO</span>
                        <span>${formatCurrency(item.basePrice)}</span>
                    </div>
                </div>

                <div style="margin-top: 40px; font-size: 10px; color: #6b7280;">
                    <p>Referencia Pesaje General: Bruto: ${report.grossWeight} lb | Tara: ${report.tareWeight} lb | Neto Total: ${report.netWeight} lb</p>
                </div>
            </div>

            <div class="footer">
                Generado el ${formatDate(new Date())} · Ticket Individual por Producto
            </div>
        </div>
        `;
        }).join('');

        return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8" />
        <style>
            /* Aquí incluyes todos tus estilos CSS originales */
            @page { margin: 10mm; }
            body { font-family: Arial, sans-serif; }
            .ticket { max-width: 800px; margin: auto; border: 1px solid #e5e7eb; padding: 10px; }
            .header { background: #1f2937; color: white; padding: 15px; display: flex; justify-content: space-between; }
            .content { padding: 20px; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            .info-box { border: 1px solid #eee; padding: 8px; }
            .badge { padding: 4px 8px; border-radius: 10px; font-size: 10px; }
            .totals { border-top: 2px solid #333; padding-top: 10px; text-align: right; }
            .grand-total { font-size: 20px; font-weight: bold; display: flex; justify-content: space-between; }
            .center { text-align: center; }
            .right { text-align: right; }
            .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #ccc; padding: 10px; }
        </style>
    </head>
    <body>
        ${ticketsHtml}
    </body>
    </html>`;
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
            // qb.andWhere('report.reportDate BETWEEN :start AND :end', 
            qb.andWhere(
                'report.reportDate >= :start AND report.reportDate <= :end',

                {
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
