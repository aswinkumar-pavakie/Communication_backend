import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SynthesizeDto {
  @ApiProperty({ example: 'Welcome to your mock interview practice session.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;

  @ApiPropertyOptional() @IsOptional() @IsString() voice?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() language?: string;

  @ApiPropertyOptional({ minimum: 0.5, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed?: number;

  @ApiPropertyOptional({ enum: ['mp3', 'wav', 'ogg'] })
  @IsOptional()
  @IsIn(['mp3', 'wav', 'ogg'])
  format?: 'mp3' | 'wav' | 'ogg';
}
