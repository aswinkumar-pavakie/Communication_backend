import { Injectable, NotFoundException } from '@nestjs/common';
import { InterviewQuestion } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InterviewQuestionService {
  constructor(private readonly prisma: PrismaService) {}

  getFirstQuestion(interviewId: string): Promise<InterviewQuestion | null> {
    return this.prisma.interviewQuestion.findFirst({
      where: { interviewId, isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  getNextQuestion(
    interviewId: string,
    afterOrder: number,
  ): Promise<InterviewQuestion | null> {
    return this.prisma.interviewQuestion.findFirst({
      where: { interviewId, isActive: true, order: { gt: afterOrder } },
      orderBy: { order: 'asc' },
    });
  }

  async getByIdOrThrow(id: string): Promise<InterviewQuestion> {
    const question = await this.prisma.interviewQuestion.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException('Interview question not found.');
    }
    return question;
  }

  countQuestions(interviewId: string): Promise<number> {
    return this.prisma.interviewQuestion.count({
      where: { interviewId, isActive: true },
    });
  }
}
