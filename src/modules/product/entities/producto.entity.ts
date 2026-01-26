import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Reporte } from '../../report/entities/report.entity';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'precio_por_quintal' })
  precioPorQuintal: number;

  @OneToMany(() => Reporte, (reporte) => reporte.producto)
  reportes: Reporte[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
