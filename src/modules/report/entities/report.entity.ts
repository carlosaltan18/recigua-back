import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { ReportItem } from './report.product.entity'

export enum WeightUnit {
  QUINTALS = 'quintals',
  POUNDS = 'pounds',
  KILOGRAMS = 'kilograms',
  TONS = 'tons',
}
export enum ReportState {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}


@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* =====================
     DATOS GENERALES
  ===================== */

  @Column({ type: 'date', name: 'report_date' })
  reportDate: Date;

  @Column({ length: 20, name: 'plate_number' })
  plateNumber: string;

  @Column({ length: 50, unique: true, name: 'ticket_number' })
  ticketNumber: string;

  /* =====================
     RELACIONES
  ===================== */

  @ManyToOne(() => Supplier, { eager: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'uuid', name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /* =====================
     PESOS
  ===================== */

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'gross_weight',
  })
  grossWeight: number; // peso bruto

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'tare_weight',
  })
  tareWeight: number; // peso tara

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'net_weight',
  })
  netWeight: number; // calculado: bruto - tara

  /* =====================
     PRECIOS
  ===================== */

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
    name: 'total_price',
  })
  totalPrice: number;

  /* =====================
     DETALLE MULTI-PRODUCTO
  ===================== */

  @OneToMany(() => ReportItem, item => item.report, {
    cascade: true,
    eager: true,
  })
  items: ReportItem[];

  /* =====================
     OTROS DATOS
  ===================== */

  @Column({ length: 200, name: 'driver_name' })
  driverName: string;

  /* =====================
     AUDITORÍA
  ===================== */

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  @Column({
    type: 'enum',
    enum: ReportState,
    default: ReportState.PENDING,
  })
  state: ReportState;


}