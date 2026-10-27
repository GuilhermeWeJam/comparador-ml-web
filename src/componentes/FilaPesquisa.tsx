// Fila de pesquisa: abre a busca do ML e mostra o formulário; Enter salva e passa para o próximo.
import { useEffect, useRef, useState } from 'react';
import type { Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { urlBusca } from '../nucleo/itens';
import type { Pesquisa } from '../nucleo/tipos';
import { brl } from '../util/formato';
import { FormPesquisa, type FormPesquisaRef } from './FormPesquisa';
import { Botao, NotaBadge, VereditoBadge } from './ui';

export function FilaPesquisa({ ids, porId, fechar, abrirDetalhe }: {
  ids: string[]; porId: Map<string, Linha>; fechar: () => void; abrirDetalhe: (id: string) => void;
}) {
  const { salvarPesquisa } = useDados();
  const [pos, setPos] = useState(0);
  const [inicio, setInicio] = useState(() => Date.now());
  const [salvo, setSalvo] = useState<string | null>(null); // id do item recém-salvo (mostra o resultado)
  const [salvando, setSalvando] = useState(false);
  const form = useRef<FormPesquisaRef>(null);
  const id = ids[pos];
  const linha = id ? porId.get(id) : undefined;
  const resultado = salvo ? porId.get(salvo) : undefined;

  function abrir(i: number) {
    const l = porId.get(ids[i]);
    if (l) window.open(urlBusca(l.item), 'busca-ml');
    setInicio(Date.now());
  }

  function proximo() {
    setSalvo(null);
    if (pos + 1 >= ids.length) { setPos(ids.length); return; }
    setPos(pos + 1);
    abrir(pos + 1);
  }

  async function salvar(p: Pesquisa) {
    setSalvando(true);
    try {
      await salvarPesquisa(p);
      setSalvo(p.itemId);
    } finally {
      setSalvando(false);
    }
  }

  // Enter no resultado = próximo; Esc = pular
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && salvo) { e.preventDefault(); proximo(); }
      else if (e.key === 'Escape' && !salvo) { e.preventDefault(); proximo(); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });

  const fim = pos >= ids.length;
  return (
    <div className="fixed bottom-0 right-0 z-40 m-0 w-full max-w-md rounded-t-xl border border-slate-300 bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:rounded-xl" data-testid="fila">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div className="text-sm font-semibold">Fila de pesquisa <span className="font-normal text-slate-500">· {Math.min(pos + 1, ids.length)} de {ids.length}</span></div>
        <button type="button" onClick={fechar} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar fila">✕</button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-4 py-3">
        {fim ? (
          <div className="text-sm">
            <p className="mb-3">Fila concluída.</p>
            <Botao onClick={fechar}>Fechar</Botao>
          </div>
        ) : resultado ? (
          <div className="grid gap-3 text-sm">
            <p className="font-medium">{resultado.item.nome}</p>
            <div className="flex flex-wrap items-center gap-2">
              Nota de decisão <NotaBadge nota={resultado.d?.nota} /> <VereditoBadge veredito={resultado.d?.veredito} motivo={resultado.d?.motivo} />
            </div>
            {resultado.d && <p className="text-slate-600">{resultado.d.motivo}</p>}
            <div className="flex flex-wrap gap-2">
              <Botao variante="primario" onClick={proximo}>Próximo (Enter)</Botao>
              <Botao onClick={() => abrirDetalhe(resultado.id)}>Abrir detalhe</Botao>
            </div>
          </div>
        ) : linha ? (
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-medium leading-snug">{linha.item.nome}</p>
              <p className="text-xs text-slate-500">Custo {brl(linha.item.custo)} · seu mínimo {brl(linha.a.classico.minimo)} (Clássico) · {brl(linha.a.premium.minimo)} (Premium)</p>
              <p className="text-xs text-slate-500">Venda sugerida: {brl(linha.a.classico.preco)} Clássico · {brl(linha.a.premium.preco)} Premium</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Botao pequeno onClick={() => abrir(pos)}>Abrir a busca no ML</Botao>
                <Botao pequeno variante="fantasma" onClick={proximo}>Pular (Esc)</Botao>
              </div>
            </div>
            <FormPesquisa ref={form} itemId={linha.id} q={linha.item.q} anterior={linha.pesq} inicio={inicio} aoSalvar={salvar} salvando={salvando} />
          </div>
        ) : (
          <div className="text-sm">Item não encontrado. <Botao pequeno onClick={proximo}>Próximo</Botao></div>
        )}
      </div>
    </div>
  );
}
