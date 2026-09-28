import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const { apiPrefix, env, port } = configureApp(app);

  await app.listen(port);
  Logger.log(`Application listening on port ${port} (${env})`, 'Bootstrap');
  Logger.log(`API base path: /${apiPrefix}`, 'Bootstrap');
}

void bootstrap();
