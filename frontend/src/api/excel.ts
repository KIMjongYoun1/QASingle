import { api } from './client';

export interface ExcelColumnConfig {
  name_col: string;
  id_col?: string;
  type_col?: string;
  input_col?: string;
  expected_col?: string;
  category_col?: string;
  sheet_name?: string;
  header_row?: number;
}

export interface ParsedExcelCase {
  id: string;
  name: string;
  type: 'Positive' | 'Negative';
  input: string;
  expected: string;
  actual: string;
  pf: 'Pass';
  owner: string;
  date: string;
  catName: string;
}

export async function previewHeaders(file: File, sheetName?: string) {
  const form = new FormData();
  form.append('file', file);
  if (sheetName) form.append('sheet_name', sheetName);
  const { data } = await api.post('/api/excel/preview-headers', form);
  return data as { sheets: string[]; headers: string[] };
}

export async function parseExcel(file: File, config: ExcelColumnConfig) {
  const form = new FormData();
  form.append('file', file);
  form.append('name_col', config.name_col);
  if (config.id_col) form.append('id_col', config.id_col);
  if (config.type_col) form.append('type_col', config.type_col);
  if (config.input_col) form.append('input_col', config.input_col);
  if (config.expected_col) form.append('expected_col', config.expected_col);
  if (config.category_col) form.append('category_col', config.category_col);
  if (config.sheet_name) form.append('sheet_name', config.sheet_name);
  form.append('header_row', String(config.header_row ?? 1));

  const { data } = await api.post('/api/excel/parse', form);
  return data as { cases: ParsedExcelCase[]; categories: string[]; headers: string[]; total: number };
}
