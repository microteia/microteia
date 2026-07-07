import type { ExpressionFunction } from '../FunctionRegistry';

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const formatDate = (date: Date, format: string): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

const dayOfWeek = (date: Date): number => date.getDay();

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const dateDiff = (date1: Date, date2: Date, unit: string): number => {
  const diffMs = date1.getTime() - date2.getTime();
  switch (unit.toLowerCase()) {
    case 'days':
    case 'dias':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    case 'hours':
    case 'horas':
      return Math.floor(diffMs / (1000 * 60 * 60));
    case 'minutes':
    case 'minutos':
      return Math.floor(diffMs / (1000 * 60));
    case 'seconds':
    case 'segundos':
      return Math.floor(diffMs / 1000);
    default:
      throw new Error(`Unidade de tempo desconhecida: ${unit}`);
  }
};

export const todayFn: ExpressionFunction = {
  name: 'today',
  call: (_args, context) => startOfDay(context.services.now()),
  description: 'Retorna a data de hoje (início do dia)',
  signature: 'today()',
  example: 'today()',
  category: 'Data',
};

export const nowFn: ExpressionFunction = {
  name: 'now',
  call: (_args, context) => context.services.now(),
  description: 'Retorna a data e hora atual',
  signature: 'now()',
  example: 'now()',
  category: 'Data',
};

export const formatDateFn: ExpressionFunction = {
  name: 'formatDate',
  call: ([date, format]) => {
    if (!(date instanceof Date)) {
      throw new Error('formatDate: primeiro argumento deve ser uma Date');
    }
    if (typeof format !== 'string') {
      throw new Error('formatDate: segundo argumento deve ser uma string');
    }
    return formatDate(date, format);
  },
  description: 'Formata uma data usando um padrão (YYYY-MM-DD HH:mm:ss)',
  signature: 'formatDate(data, formato)',
  example: 'formatDate(today(), "DD/MM/YYYY")',
  category: 'Data',
};

export const dayOfWeekFn: ExpressionFunction = {
  name: 'dayOfWeek',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new Error('dayOfWeek: argumento deve ser uma Date');
    }
    return dayOfWeek(date);
  },
  description: 'Retorna o dia da semana (0=Domingo, 1=Segunda, ..., 6=Sábado)',
  signature: 'dayOfWeek(data)',
  example: 'dayOfWeek(today())',
  category: 'Data',
};

export const isWeekendFn: ExpressionFunction = {
  name: 'isWeekend',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new Error('isWeekend: argumento deve ser uma Date');
    }
    return isWeekend(date);
  },
  description: 'Verifica se a data é fim de semana (sábado ou domingo)',
  signature: 'isWeekend(data)',
  example: 'isWeekend(today())',
  category: 'Data',
};

export const dateDiffFn: ExpressionFunction = {
  name: 'dateDiff',
  call: ([date1, date2, unit = 'days']) => {
    if (!(date1 instanceof Date)) {
      throw new Error('dateDiff: primeiro argumento deve ser uma Date');
    }
    if (!(date2 instanceof Date)) {
      throw new Error('dateDiff: segundo argumento deve ser uma Date');
    }
    if (typeof unit !== 'string') {
      throw new Error('dateDiff: terceiro argumento deve ser uma string');
    }
    return dateDiff(date1, date2, unit);
  },
  description: 'Calcula a diferença entre duas datas em dias, horas, minutos ou segundos',
  signature: 'dateDiff(data1, data2, unidade)',
  example: 'dateDiff(today(), event.deadline, "days")',
  category: 'Data',
};

export const yearFn: ExpressionFunction = {
  name: 'year',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new Error('year: argumento deve ser uma Date');
    }
    return date.getFullYear();
  },
  description: 'Extrai o ano de uma data',
  signature: 'year(data)',
  example: 'year(today())',
  category: 'Data',
};

export const monthFn: ExpressionFunction = {
  name: 'month',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new Error('month: argumento deve ser uma Date');
    }
    return date.getMonth() + 1;
  },
  description: 'Extrai o mês de uma data (1-12)',
  signature: 'month(data)',
  example: 'month(today())',
  category: 'Data',
};

export const dayFn: ExpressionFunction = {
  name: 'day',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new Error('day: argumento deve ser uma Date');
    }
    return date.getDate();
  },
  description: 'Extrai o dia do mês de uma data (1-31)',
  signature: 'day(data)',
  example: 'day(today())',
  category: 'Data',
};
