import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOptions = {
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
    maxAge: 3600,
    optionsSuccessStatus: 204,
    preflightContinue: false
  };

  // Aplicar middleware CORS de Express antes de cualquier ruta
  app.use(cors(corsOptions));

  // Habilitar CORS también para NestJS
  app.enableCors(corsOptions);

  // Configurar prefijo global
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
