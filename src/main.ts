import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, raw } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Stripe webhook necesita el body sin parsear
  app.use(
    '/api/payments/webhook',
    raw({ type: 'application/json' })
  );

  // Para el resto de rutas
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Configurar ValidationPipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no decoradas
      transform: true, // Transforma los tipos automáticamente
      forbidNonWhitelisted: true, // Rechaza propiedades no permitidas
      transformOptions: {
        enableImplicitConversion: true, // Permite conversión implícita de tipos
      },
    }),
  );

  const isDevelopment = process.env.NODE_ENV === 'development';

  const corsOptions: CorsOptions = {
    origin: isDevelopment 
      ? true // Permitir todos los orígenes en desarrollo
      : [
          'http://localhost:3000',
          'https://trader.mulfex.com',
          'https://btrader-production.up.railway.app'
        ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Accept', 
      'Origin', 
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Credentials',
      'stripe-signature'
    ],
    exposedHeaders: ['Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  app.enableCors(corsOptions);

  // Configurar prefijo global
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 8000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
