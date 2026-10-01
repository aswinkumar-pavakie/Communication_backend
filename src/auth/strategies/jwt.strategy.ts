import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Configuration } from '../../config/configuration.js';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { UsersService } from '../../users/users.service.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<Configuration, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).accessSecret,
    });
  }

  async validate(
    payload: JwtPayload & { tokenId?: string },
  ): Promise<AuthenticatedUser> {
    // Refresh tokens carry a tokenId; they must never be accepted as access tokens (which
    // would otherwise be possible if both secrets were ever configured to the same value).
    if (payload.tokenId) {
      throw new UnauthorizedException('Use an access token for this request.');
    }
    const user = await this.usersService.findByIdWithProfile(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      studentProfileId: user.studentProfile?.id ?? null,
    };
  }
}
