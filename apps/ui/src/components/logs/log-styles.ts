export const LEVEL_TREATMENT: Record<string, string> = {
  info: 'bg-secondary text-[#182012] border-[#C9E7EB]',
  warn: 'bg-[#FEF3C7] text-[#713F12] border-[#FDE68A]',
  error: 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  fatal: 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  debug: 'bg-secondary text-[#4D5A4A] border-[#242426]',
};

const ERROR_STATUS = 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]';
const OK_STATUS = 'bg-[#0B0B0C] text-[#ACFC15] border-[#16931F]';
const REDIRECT_STATUS = 'bg-[#0B0B0C] text-[#713F12] border-[#FDE68A]';
const DEFAULT_STATUS = 'bg-secondary text-[#4D5A4A] border-[#242426]';

const SAFE_METHOD = 'bg-[#0B0B0C] text-[#ACFC15] border-[#16931F]';
const MUTATION_METHOD = 'bg-[#0B0B0C] text-[#713F12] border-[#FDE68A]';
const DESTRUCTIVE_METHOD = 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]';

export function methodBadgeClass(method: string): string {
  const normalized = method.trim().toUpperCase();
  if (normalized === 'DELETE') return DESTRUCTIVE_METHOD;
  if (normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH') return MUTATION_METHOD;
  if (normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS') return SAFE_METHOD;
  return DEFAULT_STATUS;
}

export function statusBadgeClass(status: number | string | undefined): string {
  const code = Number(status);
  if (!Number.isFinite(code) || code < 100) return DEFAULT_STATUS;
  if (code >= 400) return ERROR_STATUS;
  if (code >= 300) return REDIRECT_STATUS;
  return OK_STATUS;
}
