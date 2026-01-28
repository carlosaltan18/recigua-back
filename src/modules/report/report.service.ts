import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, WeightUnit } from './entities/report.entity';
import { Product } from '../products/entities/product.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SystemConfig } from '../config/entities/config.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Report)
        private reportsRepository: Repository<Report>,
        @InjectRepository(Product)
        private productsRepository: Repository<Product>,
        @InjectRepository(Supplier)
        private suppliersRepository: Repository<Supplier>,
        @InjectRepository(SystemConfig)
        private configRepository: Repository<SystemConfig>,
    ) { }


    /* =========================
       CONVERSIONES DE PESO
    ========================= */

    private convertToQuintals(weight: number, unit: WeightUnit): number {
        const conversion: Record<WeightUnit, number> = {
            [WeightUnit.QUINTALS]: 1,
            [WeightUnit.POUNDS]: 0.01,        // 100 lb = 1 quintal
            [WeightUnit.KILOGRAMS]: 0.02174,  // 46 kg = 1 quintal
            [WeightUnit.TONS]: 21.74,         // 1 ton = 21.74 quintales
        };

        return Number((weight * conversion[unit]).toFixed(4));
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
        // ticket único
        const exists = await this.reportsRepository.findOne({
            where: { ticketNumber: dto.ticketNumber },
        });

        if (exists) {
            throw new ConflictException('El número de ticket ya existe');
        }

        const product = await this.productsRepository.findOne({
            where: { id: dto.productId },
        });
        if (!product) throw new NotFoundException('Producto no encontrado');

        const supplier = await this.suppliersRepository.findOne({
            where: { id: dto.supplierId },
        });
        if (!supplier) throw new NotFoundException('Proveedor no encontrado');

        // 🔥 ACÁ está la diferencia importante
        const config = await this.configRepository.findOne({ where: {} });
        const extraPercentage = config?.extraPercentage ?? 5;

        const weightInQuintals = this.convertToQuintals(
            dto.weight,
            dto.weightUnit,
        );

        const { basePrice, extraPrice, totalPrice } = this.calculatePrices(
            Number(product.pricePerQuintal),
            weightInQuintals,
            extraPercentage,
        );

        const report = this.reportsRepository.create({
            ...dto,
            userId,
            weightInQuintals,
            extraPercentage,
            basePrice,
            extraPrice,
            totalPrice,
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
            .leftJoinAndSelect('report.product', 'product')
            .leftJoinAndSelect('report.user', 'user')
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
            qb.andWhere('report.productId = :productId', { productId });
        }

        if (search) {
            qb.andWhere(
                `
        report.plateNumber ILIKE :search
    OR report.ticketNumber ILIKE :search
    OR report.driverName ILIKE :search
        `,
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
            relations: ['supplier', 'product', 'user'],
        });

        if (!report) {
            throw new NotFoundException('Reporte no encontrado');
        }

        return report;
    }

    /* =========================
       UPDATE
    ========================= */

    async update(id: string, dto: UpdateReportDto) {
        const report = await this.findOne(id);

        // Verificar ticket único
        if (dto.ticketNumber && dto.ticketNumber !== report.ticketNumber) {
            const exists = await this.reportsRepository.findOne({
                where: { ticketNumber: dto.ticketNumber },
            });

            if (exists) {
                throw new ConflictException('El número de ticket ya existe');
            }
        }

        const mustRecalculate =
            dto.weight !== undefined ||
            dto.weightUnit !== undefined ||
            dto.productId !== undefined;

        if (mustRecalculate) {
            const productId = dto.productId ?? report.productId;

            const product = await this.productsRepository.findOne({
                where: { id: productId },
            });

            if (!product) {
                throw new NotFoundException('Producto no encontrado');
            }

            // 🔥 SIEMPRE leer el porcentaje desde Config
            const config = await this.configRepository.findOne({ where: {} });
            const extraPercentage = config?.extraPercentage ?? report.extraPercentage;

            const weight = dto.weight ?? report.weight;
            const unit = dto.weightUnit ?? report.weightUnit;

            const weightInQuintals = this.convertToQuintals(weight, unit);

            const { basePrice, extraPrice, totalPrice } = this.calculatePrices(
                Number(product.pricePerQuintal),
                weightInQuintals,
                extraPercentage,
            );

            Object.assign(report, dto, {
                weightInQuintals,
                extraPercentage,
                basePrice,
                extraPrice,
                totalPrice,
            });
        } else {
            Object.assign(report, dto);
        }

        return this.reportsRepository.save(report);
    }


    /* =========================
       REMOVE
    ========================= */

    async remove(id: string) {
        const report = await this.findOne(id);
        await this.reportsRepository.remove(report);
        return { success: true };
    }
}
