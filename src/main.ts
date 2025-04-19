import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:3000',
        'https://trader.mulfex.com',
        'https://bedgetrader-production.up.railway.app'
      ],
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Accept', 
        'Authorization', 
        'X-Requested-With',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
      ],
      exposedHeaders: ['Authorization', 'Content-Length'],
      credentials: true,
      optionsSuccessStatus: 204,
      preflightContinue: false,
      maxAge: 3600 // Cache preflight requests for 1 hour
    }
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
