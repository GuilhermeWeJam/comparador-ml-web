// Componentes visuais pequenos usados em todo o site.
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { VEREDITOS, type Nota, type TipoVeredito } from '../nucleo/analise';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'sucesso';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
  secundario: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
  perigo: 'bg-white text-red-700 hover:bg-red-50 border-red-300',
  fantasma: 'bg-transparent text-blue-700 hover:bg-blue-50 border-transparent',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600',
};

export function Botao({ children, variante = 'secundario', pequeno, className = '', ...resto }: {
  children: ReactNode; variante?: Variante; pequeno?: boolean; className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...resto}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${pequeno ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'} ${VARIANTES[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

const CORES: Record<string, string> = {
  verde: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  azul: 'bg-blue-50 text-blue-800 ring-blue-200',
  roxo: 'bg-violet-50 text-violet-800 ring-violet-200',
  laranja: 'bg-amber-50 text-amber-800 ring-amber-200',
  vermelho: 'bg-red-50 text-red-800 ring-red-200',
  cinza: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function Etiqueta({ cor = 'cinza', children, titulo }: { cor?: string; children: ReactNode; titulo?: string }) {
  return (
    <span title={titulo} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CORES[cor] || CORES.cinza}`}>
      {children}
    </span>
  );
}

export const corDaFaixa = (f: Nota['faixa']) => (f === 'alta' ? 'verde' : f === 'media' ? 'laranja' : 'vermelho');

/** Nota de 0 a 100 com a conta ponto a ponto ao passar o mouse. */
export function NotaBadge({ nota, vazio = '—' }: { nota?: Nota; vazio?: string }) {
  if (!nota) return <span className="text-slate-400">{vazio}</span>;
  const titulo = nota.partes.map((p) => `${p.criterio}: ${p.pontos.toLocaleString('pt-BR')} de ${p.max} — ${p.texto}`).join('\n');
  return (
    <span title={titulo} className="cursor-help">
      <Etiqueta cor={corDaFaixa(nota.faixa)}><span className="num">{nota.total}</span></Etiqueta>
    </span>
  );
}

export function VereditoBadge({ veredito, motivo }: { veredito?: TipoVeredito; motivo?: string }) {
  if (!veredito) return <span className="text-slate-400">—</span>;
  const v = VEREDITOS[veredito];
  return <span title={motivo} className="cursor-help"><Etiqueta cor={v.cor}>{v.rotulo}</Etiqueta></span>;
}

export function Modal({ titulo, aberto, fechar, children, largura = 'max-w-2xl', rodape }: {
  titulo: ReactNode; aberto: boolean; fechar: () => void; children: ReactNode; largura?: string; rodape?: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aberto, fechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div role="dialog" aria-modal="true" className={`w-full ${largura} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button type="button" onClick={fechar} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

export function Campo({ rotulo, dica, children, className = '' }: { rotulo: ReactNode; dica?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      <span className="font-medium text-slate-700">{rotulo}</span>
      {children}
      {dica && <span className="text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

export const classeInput = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function Cartao({ titulo, children, acoes, className = '' }: { titulo?: ReactNode; children: ReactNode; acoes?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      {(titulo || acoes) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-base font-semibold">{titulo}</h2>}
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Numero({ valor, rotulo, detalhe }: { valor: ReactNode; rotulo: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="num text-2xl font-semibold">{valor}</div>
      <div className="text-sm text-slate-600">{rotulo}</div>
      {detalhe && <div className="mt-0.5 text-xs text-slate-500">{detalhe}</div>}
    </div>
  );
}
