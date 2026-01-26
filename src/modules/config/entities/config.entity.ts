import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('config')
export class Config {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.00, name: 'porcentaje_adicional' })
  porcentajeAdicional: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
