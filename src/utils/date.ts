// ====================================
// DOM - Date Utilities
// ====================================

/**
 * Formata data para padrão brasileiro
 */
export function formatDateBR(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formata data e hora para padrão brasileiro
 */
export function formatDateTimeBR(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Retorna data/hora atual no formato ISO
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Verifica se uma data é dia útil (não é sábado, domingo ou feriado)
 */
export function isBusinessDay(date: Date, holidays: string[]): boolean {
  const dayOfWeek = date.getDay();
  
  // Verifica se é final de semana
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Verifica se é feriado
  const dateString = date.toISOString().split('T')[0];
  if (holidays.includes(dateString)) {
    return false;
  }
  
  return true;
}

/**
 * Calcula próximo dia útil a partir de uma data
 */
export function getNextBusinessDay(date: Date, holidays: string[]): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isBusinessDay(nextDay, holidays)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

/**
 * Verifica se horário está dentro do prazo de envio
 */
export function isWithinCutoffTime(cutoffTime: string): boolean {
  const now = new Date();
  const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  if (currentHour < cutoffHour) {
    return true;
  }
  
  if (currentHour === cutoffHour && currentMinute <= cutoffMinute) {
    return true;
  }
  
  return false;
}

/**
 * Gera número de edição baseado na data
 */
export function generateEditionNumber(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Formato: YYYYMMDD
  return `${year}${month}${day}`;
}

/**
 * Converte string de data para Date
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Verifica se data é hoje
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
}

/**
 * Verifica se data é futura
 */
export function isFutureDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d > new Date();
}
