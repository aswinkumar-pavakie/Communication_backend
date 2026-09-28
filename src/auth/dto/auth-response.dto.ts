import { ApiProperty } from '@nestjs/swagger';
import { Role } from '#prisma-client';

export class StudentProfileSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ required: false, nullable: true }) department?: string | null;
  @ApiProperty({ required: false, nullable: true }) year?: number | null;
  @ApiProperty({ required: false, nullable: true }) batch?: string | null;
}

export class UserProfileDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty({
    type: StudentProfileSummaryDto,
    required: false,
    nullable: true,
  })
  studentProfile?: StudentProfileSummaryDto | null;
}

export class AuthTokensDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}
