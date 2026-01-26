import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';

export enum WeightUnit {
  QUINTALS = 'quintals',
  POUNDS = 'pounds',
  KILOGRAMS = 'kilograms',
  TONS = 'tons',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', name: 'report_date' })
  reportDate: Date;

  @Column({ length: 20, name: 'plate_number' })
  plateNumber: string;

  @Column({ unique: true, length: 50, name: 'ticket_number' })
  ticketNumber: string;

  @Column({ type: 'uuid', name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.reports, { eager: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.reports, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  weight: number;

  @Column({ length: 20, name: 'weight_unit' })
  weightUnit: WeightUnit;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    name: 'weight_in_quintals',
  })
  weightInQuintals: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'extra_percentage',
  })
  extraPercentage: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'base_price',
  })
  basePrice: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'extra_price',
  })
  extraPrice: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'total_price',
  })
  totalPrice: number;

  @Column({ length: 200, name: 'driver_name' })
  driverName: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.reports)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
