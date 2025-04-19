import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://trader.mulfex.com'
    ],
    credentials: true
  });

  // Configurar prefijo global
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
