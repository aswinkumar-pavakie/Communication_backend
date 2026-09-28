import { Injectable } from '@nestjs/common';
import { Prisma, User } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateStudentUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  department?: string;
  year?: number;
  batch?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByIdWithProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true },
    });
  }

  /**
   * Creates the User + StudentProfile in a single transaction so a failure in either
   * write never leaves an orphaned account behind.
   */
  createStudentUser(input: CreateStudentUserInput) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
        },
      });

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          department: input.department,
          year: input.year,
          batch: input.batch,
        },
      });

      return { ...user, studentProfile };
    });
  }
}
