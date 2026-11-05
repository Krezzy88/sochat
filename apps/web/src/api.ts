export interface User {
  id: string;
  email: string;
  display_name: string;
}
export interface Category {
  id: string;
  key: string;
  name_vi: string;
  type: 'income' | 'expense';
}
export interface Transaction {
  id: string;
  version: string;
  type: 'income' | 'expense';
  category: string;
  amount_vnd: string;
  note: string;
  occurred_on: string;
}
export type Draft = Omit<Transaction, 'id' | 'version'>;
export interface Proposal {
  provider: 'gemini' | 'fake';
  path: 'rules' | 'llm' | 'cache';
  items: (Omit<Draft, 'amount_vnd' | 'occurred_on'> & {
    amount_vnd: number | null;
    occurred_on: string | null;
    confidence: number | null;
    flags: string[];
  })[];
  needs_clarification: boolean;
  questions: string[];
  reasons: string[];
}
export interface Totals {
  income_vnd: string;
  expense_vnd: string;
  net_vnd: string;
}
export interface MonthReport {
  totals: Totals;
  by_category: {
    category: string;
    name_vi: string;
    type: string;
    total_vnd: string;
  }[];
  daily: { occurred_on: string; type: string; total_vnd: string }[];
  top_notes: { note: string; total_vnd: string }[];
  notice: string;
}
export interface YearReport {
  totals: Totals;
  months: { month: string; type: string; total_vnd: string }[];
  notice: string;
}
export interface Budget {
  version: string;
  category: string;
  limit_vnd: string;
  spent_vnd: string;
  remaining_vnd: string;
  status: 'ok' | 'warning' | 'exceeded';
}
export interface Goal {
  id: string;
  version: string;
  name: string;
  target_vnd: string;
  deadline: string;
  contributed_vnd: string;
  remaining_vnd: string;
  progress_basis_points: number;
  days_left: number;
  suggested_daily_saving_vnd: string | null;
}
let csrf = '';
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      credentials: 'include',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrf }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được. Kiểm tra mạng rồi thử lại.');
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    if (response.status === 401 && !path.startsWith('/auth/') && path !== '/me')
      window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(
      response.status,
      problem?.detail ?? 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
    );
  }
  if (response.status === 204) return undefined as T;
  let data: T & { csrf_token?: string };
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      503,
      'Máy chủ chưa sẵn sàng. Vui lòng chờ một chút rồi thử lại.',
    );
  }
  if (data.csrf_token) csrf = data.csrf_token;
  return data;
}
export async function downloadCsv() {
  const response = await fetch('/api/me/export', { credentials: 'include' });
  if (!response.ok) {
    const p = await response.json().catch(() => null);
    throw new Error(p?.detail ?? 'Không thể xuất dữ liệu. Vui lòng thử lại.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sochat-giao-dich.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const money = (value: string | bigint | number) => {
  try {
    const big =
      typeof value === 'bigint'
        ? value
        : typeof value === 'number'
          ? BigInt(Math.round(value))
          : BigInt(value || '0');
    return moneyFormatter.format(big);
  } catch {
    return '0 ₫';
  }
};

const todayFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const today = () => todayFormatter.format(new Date());
export const dateLabel = (date: string) => date.split('-').reverse().join('/');
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
