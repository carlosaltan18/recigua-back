import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  async create(createSupplierDto: CreateSupplierDto) {
    const supplier = this.supplierRepository.create(createSupplierDto);
    return this.supplierRepository.save(supplier);
  }

  async findAll(page = 1, pageSize = 10, search?: string) {
    const skip = (page - 1) * pageSize;
    const queryBuilder = this.supplierRepository.createQueryBuilder('supplier');

    if (search) {
      queryBuilder.where(
        '(supplier.name ILIKE :search OR supplier.representative ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
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

  async findOne(id: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id } });
    
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

  async update(id: string, updateProveedorDto: UpdateSupplierDto) {
    const supplier = await this.findOne(id);
    Object.assign(supplier, updateProveedorDto);
    return this.supplierRepository.save(supplier);
  }

  async remove(id: string) {
    const supplier = await this.findOne(id);
    await this.supplierRepository.remove(supplier);
    return { success: true };
  }
}