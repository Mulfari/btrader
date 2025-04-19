import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1) Habilitar CORS antes de cualquier otra configuración
  app.enableCors({
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
    maxAge: 3600
  });

  // 2) Establecer el prefijo global para todas las rutas API
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
