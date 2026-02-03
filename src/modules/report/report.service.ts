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


}
