import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 5.0,
    name: 'extra_percentage',
  })
  extraPercentage: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}