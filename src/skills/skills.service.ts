import { Injectable, NotFoundException } from '@nestjs/common';
import { Skill, SkillCode } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findByCode(code: SkillCode): Promise<Skill> {
    const skill = await this.prisma.skill.findUnique({ where: { code } });
    if (!skill) {
      throw new NotFoundException(`Skill "${code}" is not configured.`);
    }
    return skill;
  }

  async findByCodes(codes: SkillCode[]): Promise<Skill[]> {
    return this.prisma.skill.findMany({ where: { code: { in: codes } } });
  }
}
