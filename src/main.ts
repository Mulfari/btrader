import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:3000',
        'https://trader.mulfex.com'
      ],
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
      credentials: true,
      optionsSuccessStatus: 204,
      preflightContinue: false
    }
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
