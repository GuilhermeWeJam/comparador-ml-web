// Aprovados: lista de EANs para mandar ao Mercado Livre e links das fotos de cada item para subir no ML.
import { useEffect, useMemo, useState } from 'react';
import type { Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { Botao, classeInput, Etiqueta } from './ui';

/** Separa os links digitados (por linha, vírgula, ponto e vírgula ou espaço). */
export function separarFotos(texto: string | null | undefined): string[] {
  return String(texto || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
}

/** EANs únicos dos itens, na ordem da lista (unidade e kit do mesmo produto usam o mesmo EAN). */
export function listaEans(linhas: Linha[]): string[] {
  const vistos = new Set<string>();
  for (const l of linhas) {
    const e = (l.item.produto.ean || '').trim();
    if (e) vistos.add(e);
  }
  return [...vistos];
}

async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

/** Caixa com os EANs da lista, separados por vírgula, e o botão de copiar. */
export function CaixaEans({ linhas }: { linhas: Linha[] }) {
  const { avisar } = useDados();
  const ativos = useMemo(() => linhas.filter((l) => !l.foraDaLista), [linhas]);
  const eans = useMemo(() => listaEans(ativos), [ativos]);
  const semEan = ativos.filter((l) => !(l.item.produto.ean || '').trim());
  const fora = linhas.length - ativos.length;
  const texto = eans.join(',');
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3" data-testid="caixa-eans">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">EANs para o Mercado Livre <Etiqueta cor="azul">{eans.length}</Etiqueta></div>
        <Botao pequeno variante="primario" disabled={!eans.length}
          onClick={async () => avisar((await copiar(texto)) ? `${eans.length} EANs copiados.` : 'Não consegui copiar: clique no campo, selecione tudo e use Ctrl+C.')}>
          Copiar EANs
        </Botao>
      </div>
      {eans.length === 0 ? <p className="text-sm text-slate-500">Nenhum item desta lista tem EAN.</p> : (
        <textarea readOnly className={`${classeInput} h-16 font-mono text-xs`} value={texto} onFocus={(e) => e.currentTarget.select()} data-testid="eans" />
      )}
      <p className="mt-1 text-xs text-slate-500">
        Dos itens desta lista (os filtros valem aqui), separados por vírgula e sem repetir.
        {fora > 0 && ` ${fora} aprovado(s) que saíram da lista do fornecedor ficam de fora.`}
      </p>
      {semEan.length > 0 && <p className="mt-1 text-xs text-amber-800">Sem EAN na planilha: {semEan.map((l) => l.item.produto.sku).join(', ')}.</p>}
    </div>
  );
}

/** Campo dos links das fotos de um item. Salva ao sair do campo. */
export function CampoFotos({ linha, compacto = false }: { linha: Linha; compacto?: boolean }) {
  const { anotar, avisar } = useDados();
  const salvo = linha.anot?.fotos || '';
  const [texto, setTexto] = useState(salvo);
  useEffect(() => setTexto(salvo), [salvo]);
  const links = separarFotos(texto);

  async function salvar() {
    const novo = separarFotos(texto).join('\n');
    if (novo === separarFotos(salvo).join('\n')) return;
    try {
      await anotar(linha.id, { fotos: novo || null });
      setTexto(novo);
      avisar(`${linha.item.nome}: ${separarFotos(novo).length} link(s) de fotos salvos.`);
    } catch (e) {
      avisar('Erro ao salvar as fotos: ' + (e as Error).message);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <textarea
        className={`${classeInput} ${compacto ? 'h-14' : 'h-24'} text-xs`}
        placeholder="Links das fotos, um por linha"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
        aria-label={`Links das fotos de ${linha.item.nome}`}
        data-testid="campo-fotos"
      />
      <div className={`mt-0.5 text-xs ${links.length ? 'text-slate-500' : 'text-amber-700'}`}>{links.length ? `${links.length} ${links.length === 1 ? 'link' : 'links'}` : 'sem fotos'}</div>
    </div>
  );
}
