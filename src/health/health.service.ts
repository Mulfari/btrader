import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Iniciar el ping cada 4 minutos (240000 ms)
    // Lo hacemos cada 4 minutos porque UptimeRobot lo hará cada 5
    setInterval(() => this.pingServer(), 240000);
  }

  private async pingServer() {
    try {
      const url = this.configService.get('APP_URL') || 'https://btrader-production.up.railway.app';
      await fetch(`${url}/health`);
      console.log(`Health check ping successful at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`Health check ping failed: ${error.message}`);
    }
  }
} 