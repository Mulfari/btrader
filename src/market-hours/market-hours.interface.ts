export interface MarketTime {
  id: string; // Ejemplo: "nyse", "lse"
  name: string; // Ejemplo: "New York Stock Exchange", "London Stock Exchange"
  timeZone: string; // Ejemplo: "America/New_York", "Europe/London"
  openTimeLocal: string; // Ejemplo: "09:30" (hora local del mercado)
  closeTimeLocal: string; // Ejemplo: "16:00" (hora local del mercado)
  daysOfWeek: number[]; // 0 (Domingo) a 6 (Sábado) - días que opera en su hora local
  // Podríamos añadir opcionalmente una lista de festivos aquí en el futuro
  // holidays?: string[]; // Array de fechas YYYY-MM-DD
} 