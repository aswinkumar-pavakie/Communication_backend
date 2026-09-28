import { Injectable, NotFoundException } from '@nestjs/common';
import { Activity, Prisma } from '#prisma-client';
import { PaginatedResult } from '../common/types/api-response.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivityQueryDto } from './dto/activity-query.dto.js';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ActivityQueryDto): Promise<PaginatedResult<Activity>> {
    const type = query.type ?? query.category;

    const where: Prisma.ActivityWhereInput = {
      isActive: true,
      ...(type ? { type } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.skill ? { skill: { code: query.skill } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        include: { skill: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<Activity> {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: { skill: true },
    });
    if (!activity) {
      throw new NotFoundException('Activity not found.');
    }
    return activity;
  }
}
