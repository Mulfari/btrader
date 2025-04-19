import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',           // Frontend en desarrollo
      'https://bedgetrader.vercel.app',  // Frontend en producción
      'https://bedgetrader-production.up.railway.app', // Frontend en producción (alternativo)
      'https://bedgetrader-production.up.railway.app/api' // URL base de la API
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 3600
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
