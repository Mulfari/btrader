import { Injectable } from '@nestjs/common';
import { MarketTime } from './market-hours.interface';

@Injectable()
export class MarketHoursService {
  private readonly markets: MarketTime[] = [
    {
      id: 'nyse',
      name: 'New York Stock Exchange',
      timeZone: 'America/New_York',
      openTimeLocal: '09:30',
      closeTimeLocal: '16:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Lunes a Viernes
      // holidays: ['2024-01-01', '2024-07-04'] // Ejemplo de festivos
    },
    {
      id: 'lse',
      name: 'London Stock Exchange',
      timeZone: 'Europe/London',
      openTimeLocal: '08:00',
      closeTimeLocal: '16:30',
      daysOfWeek: [1, 2, 3, 4, 5], // Lunes a Viernes
    },
    {
      id: 'tse',
      name: 'Tokyo Stock Exchange',
      timeZone: 'Asia/Tokyo',
      openTimeLocal: '09:00',
      closeTimeLocal: '15:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Lunes a Viernes
    },
    {
      id: 'hkex',
      name: 'Hong Kong Stock Exchange',
      timeZone: 'Asia/Hong_Kong',
      openTimeLocal: '09:30',
      closeTimeLocal: '16:00',
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    {
      id: 'sse',
      name: 'Shanghai Stock Exchange',
      timeZone: 'Asia/Shanghai',
      openTimeLocal: '09:30',
      closeTimeLocal: '15:00',
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    {
      id: 'asx',
      name: 'Australian Securities Exchange',
      timeZone: 'Australia/Sydney',
      openTimeLocal: '10:00',
      closeTimeLocal: '16:00',
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    // Aquí podríamos añadir más mercados en el futuro
  ];

  findAll(): MarketTime[] {
    // En el futuro, esto podría obtener datos de una base de datos o un servicio externo
    return this.markets;
  }

  // Podríamos añadir métodos para obtener por ID, manejar festivos, etc.
} 