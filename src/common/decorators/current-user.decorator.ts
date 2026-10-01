import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user.type.js';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    const value = data ? user?.[data] : user;
    // Student-only routes ask for studentProfileId. Faculty/admin accounts have none, and
    // querying with studentId: null would surface as a confusing 400/500 - say it plainly.
    if (data === 'studentProfileId' && !value) {
      throw new ForbiddenException(
        'This feature is only available to student accounts.',
      );
    }
    return value;
  },
);
