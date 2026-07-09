import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte um valor de data vindo do banco em um Date ancorado ao MEIO-DIA LOCAL.
 *
 * As colunas `date`/`renewal_date`/`first_installment_date` são do tipo Postgres
 * `DATE` e voltam como string "YYYY-MM-DD" (sem hora). `new Date("YYYY-MM-DD")`
 * é interpretado como meia-noite UTC — em fuso do Brasil (UTC-3) isso vira o dia
 * anterior às 21h, causando o bug de "vencimento 1 dia antes" e parcelas que
 * "somem" no mês seguinte quando caem no dia 1º. Ancorar ao meio-dia local
 * preserva o dia do calendário em qualquer fuso.
 *
 * Também aceita timestamps legados do Firestore ({ seconds }).
 */
export function parseLocalDate(value: any): Date {
  if (value == null) return new Date(NaN);
  if (typeof value === "object" && value.seconds != null) {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return new Date(value);
  }
  return new Date(value);
}

/**
 * Normaliza um valor de data do formulário (que pode ser "YYYY-MM-DD" ou um ISO
 * completo, no caso de edição) para o ISO que gravamos numa coluna DATE, fixando
 * meio-dia UTC para não deslocar o dia. Retorna null quando não há data.
 */
export function toDbDate(value: any): string | null {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(s + "T12:00:00Z").toISOString();
}
