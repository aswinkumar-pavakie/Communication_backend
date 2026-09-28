import { Injectable } from '@nestjs/common';
import { Prisma, SkillCode } from '#prisma-client';
import { CommunicationAssessmentResult } from '../ai/assessment/assessment.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForAttempt(
    attemptId: string,
    result: CommunicationAssessmentResult,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const skills = await tx.skill.findMany({
      where: {
        code: { in: result.skillScores.map((s) => s.skillCode as SkillCode) },
      },
    });
    const skillIdByCode = new Map(skills.map((s) => [s.code as string, s.id]));

    return tx.assessment.create({
      data: {
        attemptId,
        overallScore: result.overallScore,
        feedback: result.feedback,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        suggestedResponse: result.suggestedResponse,
        scores: {
          create: result.skillScores
            .filter((s) => skillIdByCode.has(s.skillCode))
            .map((s) => ({
              skillId: skillIdByCode.get(s.skillCode)!,
              score: s.score,
            })),
        },
      },
      include: { scores: { include: { skill: true } } },
    });
  }

  findByAttemptId(attemptId: string) {
    return this.prisma.assessment.findUnique({
      where: { attemptId },
      include: { scores: { include: { skill: true } } },
    });
  }
}
