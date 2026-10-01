import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'student@college.edu' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'student@college.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482913',
    description: 'The 6-digit code from the email.',
  })
  @Matches(/^\d{6}$/, {
    message: 'code must be the 6-digit number from the email',
  })
  code: string;

  @ApiProperty({ example: 'NewStrongPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ example: 'NewStrongPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
