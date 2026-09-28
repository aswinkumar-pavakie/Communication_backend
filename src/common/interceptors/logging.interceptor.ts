import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request & { requestId?: string }>();
    const response = httpContext.getResponse<Response>();
    const { method, originalUrl, requestId } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} +${duration}ms${requestId ? ` [${requestId}]` : ''}`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - start;
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          const message = `${method} ${originalUrl} -> ${status} +${duration}ms${requestId ? ` [${requestId}]` : ''}: ${error.message}`;
          // Client errors (4xx - bad password, validation, not found) are routine and
          // logged as warnings; only genuine server-side failures are logged as errors.
          if (status >= 500) {
            this.logger.error(message);
          } else {
            this.logger.warn(message);
          }
        },
      }),
    );
  }
}
