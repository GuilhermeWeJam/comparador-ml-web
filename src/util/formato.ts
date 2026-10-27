const fBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fPct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const brl = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) ? fBrl.format(v) : '—');
export const pct = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) ? fPct.format(v) : '—');
export const num = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) ? fNum.format(v) : '—');
export const kg = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) ? fNum.format(v) + ' kg' : '—');

export function data(iso: string | null | undefined, comHora = false): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return comHora
    ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR');
}

/** Lê um número digitado em português ("1.234,56", "12,5") ou com ponto. */
export function lerNumero(s: string): number {
  const t = String(s || '').replace(/R\$\s?/, '').replace(/%/, '').trim();
  if (!t) return NaN;
  if (/,/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t);
}

export const nomeCurto = (email: string | null | undefined) => (email ? email.split('@')[0] : '—');
