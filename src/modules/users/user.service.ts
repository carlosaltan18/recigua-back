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
  ) { }

  /**
   * Funcion para crear un nuevo usuario
   * @param createUserDto 
   * @returns nuevo usuario creado
   */
  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Obtener los roles - si no se proporcionan, asignar ROLE_USER por defecto
    let roles: Role[];

    const userRole = await this.rolesRepository.findOne({
      where: { name: 'ROLE_USER' },
    });
    roles = userRole ? [userRole] : [];

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      roles,
    });

    const savedUser = await this.usersRepository.save(user);
    const { password, ...result } = savedUser;
    return result;
  }

  /**
   * Método para obtener todos los usuarios con paginación y búsqueda
   * @param page 
   * @param pageSize 
   * @param search 
   * @returns 
   */
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

  /**
   * Método para obtener un usuario por ID
   * @param id 
   * @returns 
   */

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

  /**
   * Método para encontrar un usuario por email
   * @param email 
   * @returns 
   */
  async findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
  }

  /**
   * Método para actualizar un usuario
   * @param id 
   * @param updateUserDto 
   * @returns 
   */
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

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Actualizar los demás campos
    Object.assign(user, updateUserDto);

    const updatedUser = await this.usersRepository.save(user);
    const { password, ...result } = updatedUser;
    return result;
  }

  /**
   * Método para eliminar un usuario
   * @param id 
   * @returns 
   */
  async remove(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.usersRepository.remove(user);
    return { success: true };
  }

  /**
   * Método para cambiar el rol de un usuario
   * @param id - ID del usuario
   * @param roleNames - Array de nombres de los roles a asignar (ej: ['ROLE_ADMIN', 'ROLE_USER'])
   * @returns Usuario con los nuevos roles asignados
   */
  async changeRole(id: string, roleNames: string[]) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Obtener los roles por sus nombres
    const roles = await this.rolesRepository.find({
      where: roleNames.map(name => ({ name })),
    });

    if (roles.length !== roleNames.length) {
      throw new NotFoundException('Uno o más roles no fueron encontrados');
    }

    // Asignar los nuevos roles
    user.roles = roles;

    const updatedUser = await this.usersRepository.save(user);
    
    return this.findOne(updatedUser.id);
  }

  /**
   * Método para remover roles de un usuario
   * @param id - ID del usuario
   * @param roleNames - Array de nombres de los roles a remover (ej: ['ROLE_ADMIN'])
   * @returns Usuario con los roles removidos
   */
  async removeRole(id: string, roleNames: string[]) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Obtener los roles a remover
    const rolesToRemove = await this.rolesRepository.find({
      where: roleNames.map(name => ({ name })),
    });

    if (rolesToRemove.length !== roleNames.length) {
      throw new NotFoundException('Uno o más roles no fueron encontrados');
    }

    // Remover los roles (filtrar los que no están en la lista)
    user.roles = user.roles.filter(
      role => !rolesToRemove.some(removeRole => removeRole.id === role.id)
    );

    // Validar que al menos tenga un rol
    if (user.roles.length === 0) {
      throw new ConflictException('El usuario debe tener al menos un rol');
    }

    const updatedUser = await this.usersRepository.save(user);
    
    return this.findOne(updatedUser.id);
  }

  
}
