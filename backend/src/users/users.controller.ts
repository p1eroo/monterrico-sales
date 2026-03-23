import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type RequestUser = {
  userId: string;
  username: string;
  name: string;
  role: string;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @Req() req: { user: RequestUser },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Solo administradores pueden crear usuarios',
      );
    }
    return this.usersService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: RequestUser },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Solo administradores pueden modificar usuarios',
      );
    }
    return this.usersService.update(id, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }
}
