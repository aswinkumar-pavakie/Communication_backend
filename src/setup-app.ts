import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { Configuration } from './config/configuration.js';

/**
 * Shared app wiring used by both the real bootstrap (main.ts) and e2e tests, so a test
 * boots the exact same prefix/pipes/filters/interceptors as production instead of a
 * hand-rolled approximation that could silently drift.
 */
export function configureApp(app: INestApplication): {
  apiPrefix: string;
  env: string;
  port: number;
} {
  const configService = app.get(ConfigService<Configuration, true>);
  const appConfig = configService.get('app', { infer: true });
  const corsConfig = configService.get('cors', { infer: true });

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: corsConfig.origins.length > 0 ? corsConfig.origins : true,
    credentials: true,
  });

  app.setGlobalPrefix(appConfig.apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  if (appConfig.env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Communication Assistant API')
      .setDescription(
        'English communication and placement-training platform backend. ' +
          'Endpoints are grouped by domain: auth, activities, progress, interviews, voice, ai, reports.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${appConfig.apiPrefix}/docs`, app, document);
  }

  return {
    apiPrefix: appConfig.apiPrefix,
    env: appConfig.env,
    port: appConfig.port,
  };
}
