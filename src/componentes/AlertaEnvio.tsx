// Alerta da blacklist do Mercado Envios (src/nucleo/blacklistEnvio.ts), com tooltip.
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Alerta } from '../nucleo/tipos';

/** Tooltip que aparece ao passar o mouse (ou focar com o teclado). Fica por cima de tudo, mesmo dentro de listas com rolagem. */
export function Dica({ conteudo, children }: { conteudo: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; baixo: boolean } | null>(null);
  const abrir = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const baixo = r.top < 180; // perto do topo: abre para baixo
    setPos({ x: Math.min(Math.max(r.left, 8), window.innerWidth - 328), y: baixo ? r.bottom + 6 : r.top - 6, baixo });
  };
  return (
    <span ref={ref} className="inline-flex" tabIndex={0} onMouseEnter={abrir} onMouseLeave={() => setPos(null)} onFocus={abrir} onBlur={() => setPos(null)}>
      {children}
      {pos && createPortal(
        <div role="tooltip" className="pointer-events-none fixed z-[70] w-80 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl"
          style={{ left: pos.x, top: pos.y, transform: pos.baixo ? undefined : 'translateY(-100%)' }}>
          {conteudo}
        </div>,
        document.body,
      )}
    </span>
  );
}

/** Texto do tooltip: classe, termo encontrado e exemplos da tabela do ML. */
export function TextoRestricao({ r }: { r: NonNullable<Alerta['restricao']> }) {
  return (
    <>
      <div className="font-semibold">Não pode ir pelo Mercado Envios</div>
      <div className="mt-0.5">{r.classe} · {r.nome}</div>
      <div className="mt-0.5 text-slate-300">Encontrado no nome: “{r.termo}”</div>
      <div className="mt-1 text-slate-300">Exemplos da classe: {r.exemplos}</div>
      <div className="mt-1 text-amber-200">Triagem pelo nome: confirme com o fornecedor.</div>
    </>
  );
}

/** Etiqueta vermelha "Envio" com o tooltip da restrição. Não mostra nada se o item não tem restrição. */
export function AlertaEnvio({ alertas }: { alertas: Alerta[] }) {
  const r = alertas.find((a) => a.tipo === 'Envio')?.restricao;
  if (!r) return null;
  return (
    <Dica conteudo={<TextoRestricao r={r} />}>
      <span className="inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white" data-testid="alerta-envio" onClick={(e) => e.stopPropagation()}>
        ⚠ Envio proibido
      </span>
    </Dica>
  );
}
