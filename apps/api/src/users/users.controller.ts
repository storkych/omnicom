import { Controller, Get, UseGuards } from '@nestjs/common';
import { Manager } from '@omnicom/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<Manager[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true },
    });
    return users;
  }
}
