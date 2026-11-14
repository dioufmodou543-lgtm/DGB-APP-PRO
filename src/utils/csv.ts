/**
 * Export CSV compatible Excel (version française) :
 * - séparateur « ; » (Excel FR utilise la virgule comme séparateur décimal)
 * - BOM UTF-8 pour que les accents s'affichent correctement
 * - échappement des guillemets, retours à la ligne et séparateurs
 * - neutralisation des formules (=, +, -, @) contre l'injection CSV
 */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') return String(raw);
  let value = String(raw);
  // « +221 77 … » (téléphone) reste intact ; « =CMD(...) » ou « +1+cmd| » est neutralisé
  if (/^[=@\t\r]/.test(value) || /^[+-](?![\d\s.]+$)/.test(value)) {
    value = `'${value}`;
  }
  if (/[";\n\r]/.test(value)) {
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(';');
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(';'));
  return [header, ...body].join('\r\n');
}

export function downloadCSV<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const content = '﻿' + toCSV(rows, columns);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function todayStamp(): string {
  return new Date().toISOString().split('T')[0];
}
