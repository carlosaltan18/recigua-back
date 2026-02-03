import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangeRoleDto } from './dto/change-role.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ROLE_ADMIN')
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    @Get()
    findAll(
        @Query('page') page?: number,
        @Query('pageSize') pageSize?: number,
        @Query('search') search?: string,
    ) {
        return this.usersService.findAll(page, pageSize, search);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles('ROLE_ADMIN')
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }

    @Put('profile/me')
    @UseGuards(RolesGuard)
    updateProfile(@Req() req: any, @Body() updateUserDto: UpdateUserDto) {
        const userId = req.user.sub;
        return this.usersService.update(userId, updateUserDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('ROLE_ADMIN')
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }

    @Put(':id/roles')
    @UseGuards(RolesGuard)
    @Roles('ROLE_ADMIN')
    changeRole(@Param('id') id: string, @Body() changeRoleDto: ChangeRoleDto) {
        return this.usersService.changeRole(id, changeRoleDto.roleNames);
    }

    @Delete(':id/roles')
    @UseGuards(RolesGuard)
    @Roles('ROLE_ADMIN')
    removeRole(@Param('id') id: string, @Body() changeRoleDto: ChangeRoleDto) {
        return this.usersService.removeRole(id, changeRoleDto.roleNames);
    }
    
}