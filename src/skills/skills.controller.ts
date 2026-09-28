import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Skill } from '#prisma-client';
import { SkillsService } from './skills.service.js';

@ApiTags('skills')
@ApiBearerAuth()
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the communication skills tracked by the platform.',
  })
  findAll(): Promise<Skill[]> {
    return this.skillsService.findAll();
  }
}
