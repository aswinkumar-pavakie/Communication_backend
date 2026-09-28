import { Injectable, NotFoundException } from '@nestjs/common';
import { StudentProfile } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<StudentProfile | null> {
    return this.prisma.studentProfile.findUnique({ where: { userId } });
  }

  async getByIdOrThrow(id: string): Promise<StudentProfile> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Student profile not found.');
    }
    return profile;
  }
}
