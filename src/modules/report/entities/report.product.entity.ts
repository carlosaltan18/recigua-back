import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Report } from './report.entity';
import { Product } from '../../products/entities/product.entity';
import { WeightUnit } from './report.entity';

@Entity('report_items')
export class ReportItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* =====================
     RELACIONES
  ===================== */

  @ManyToOne(() => Report, report => report.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'report_id' })
  report: Report;

  @Column({ type: 'uuid', name: 'report_id' })
  reportId: string;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  /* =====================
     DATOS DE PESO
  ===================== */

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  weight: number;

  @Column({
    type: 'enum',
    enum: WeightUnit,
    enumName: 'weight_unit_enum',
    name: 'weight_unit',
  })
  weightUnit: WeightUnit;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    name: 'weight_in_quintals',
  })
  weightInQuintals: number;

  /* =====================
     PRECIOS
  ===================== */

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'price_per_quintal',
  })
  pricePerQuintal: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'base_price',
  })
  basePrice: number;

 /*  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'discount_weight',
  })
  discountWeight: number; */
  /* =====================
     AUDITORÍA
  ===================== */

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
