import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Report } from '../../report/entities/report.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'price_per_quintal',
  })
  pricePerQuintal: number;

  @OneToMany(() => Report, (report) => report.product)
  reports: Report[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
