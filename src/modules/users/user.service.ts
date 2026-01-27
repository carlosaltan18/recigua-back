import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    // Verificar si el email ya existe
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Obtener los roles
    const roles = await this.rolesRepository.findByIds(createUserDto.roleIds);

    // Crear el usuario
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      roles,
    });

    const savedUser = await this.usersRepository.save(user);
    const { password, ...result } = savedUser;
    return result;
  }

  async findAll(page = 1, pageSize = 10, search?: string) {
    const skip = (page - 1) * pageSize;
    
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.createdAt',
        'user.updatedAt',
        'roles.id',
        'roles.name',
      ]);

    if (search) {
      queryBuilder.where(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
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
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
      select: ['id', 'firstName', 'lastName', 'email', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se proporciona un nuevo email, verificar que no esté en uso
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    // Si se proporciona nueva contraseña, hashearla
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Si se proporcionan roleIds, actualizar los roles
    if (updateUserDto.roleIds) {
      const roles = await this.rolesRepository.findByIds(updateUserDto.roleIds);
      user.roles = roles;
    }

    // Actualizar los demás campos
    Object.assign(user, updateUserDto);
    
    const updatedUser = await this.usersRepository.save(user);
    const { password, ...result } = updatedUser;
    return result;
  }

  async remove(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.usersRepository.remove(user);
    return { success: true };
  }
}
