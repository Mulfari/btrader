import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',           // Frontend en desarrollo
      'https://bedgetrader.vercel.app',  // Frontend en producción
      'https://bedgetrader-production.up.railway.app' // Frontend en producción (alternativo)
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
