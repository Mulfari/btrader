import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS
  app.enableCors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'https://bedgetrader.vercel.app',
        'https://bedgetrader-production.up.railway.app'
      ];
      
      // Permitir solicitudes sin origen (como las llamadas desde Postman)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Verificar si el origen está en la lista de permitidos
      if (allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
