// Aprovados: lista de EANs para mandar ao Mercado Livre e links das fotos de cada item para subir no ML.
import { useEffect, useMemo, useState } from 'react';
import type { Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import type { AnuncioMl } from '../nucleo/tipos';
import { brl } from '../util/formato';
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

/** Caixa com os EANs da lista, separados por vírgula, e o botão de copiar (uma linha só). */
export function CaixaEans({ linhas }: { linhas: Linha[] }) {
  const { avisar } = useDados();
  const ativos = useMemo(() => linhas.filter((l) => !l.foraDaLista), [linhas]);
  const eans = useMemo(() => listaEans(ativos), [ativos]);
  const semEan = ativos.filter((l) => !(l.item.produto.ean || '').trim());
  const fora = linhas.length - ativos.length;
  const texto = eans.join(',');
  const avisos = [
    fora > 0 ? `${fora} que saíram da lista do fornecedor ficam de fora` : '',
    semEan.length ? `sem EAN: ${semEan.map((l) => l.item.produto.sku).join(', ')}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5" data-testid="caixa-eans">
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap text-sm font-semibold">EANs para o ML <Etiqueta cor="azul">{eans.length}</Etiqueta></span>
        <input readOnly className={`${classeInput} min-w-0 flex-1 font-mono text-xs`} value={texto} placeholder="Nenhum item desta lista tem EAN"
          onFocus={(e) => e.currentTarget.select()} data-testid="eans" title="Dos itens desta lista (os filtros valem), separados por vírgula e sem repetir" />
        <Botao pequeno variante="primario" disabled={!eans.length}
          onClick={async () => avisar((await copiar(texto)) ? `${eans.length} EANs copiados.` : 'Não consegui copiar: clique no campo, selecione tudo e use Ctrl+C.')}>
          Copiar EANs
        </Botao>
      </div>
      {avisos && <p className="mt-1 text-xs text-amber-800">{avisos}</p>}
    </div>
  );
}

export const ROTULO_ANUNCIO: Record<AnuncioMl, string> = { classico: 'Clássico', premium: 'Premium', ambos: 'Os dois' };

/** Escolha do tipo de anúncio do item: Clássico, Premium ou os dois. Clicar de novo na opção marcada desmarca. */
export function EscolhaAnuncio({ linha }: { linha: Linha }) {
  const { anotar, avisar } = useDados();
  const atual = linha.anot?.anuncio || null;
  async function escolher(v: AnuncioMl) {
    try { await anotar(linha.id, { anuncio: atual === v ? null : v }); } catch (e) { avisar('Erro ao salvar o tipo de anúncio: ' + (e as Error).message); }
  }
  const preco = atual === 'classico' ? brl(linha.a.classico.preco) : atual === 'premium' ? brl(linha.a.premium.preco) : atual === 'ambos' ? `${brl(linha.a.classico.preco)} / ${brl(linha.a.premium.preco)}` : null;
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs" role="group" aria-label={`Tipo de anúncio de ${linha.item.nome}`}>
        {(['classico', 'premium', 'ambos'] as AnuncioMl[]).map((v, i) => (
          <button key={v} type="button" aria-pressed={atual === v} onClick={() => escolher(v)}
            className={`px-2 py-1 ${i ? 'border-l border-slate-300' : ''} ${atual === v ? 'bg-blue-600 font-medium text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
            {ROTULO_ANUNCIO[v]}
          </button>
        ))}
      </div>
      <div className={`mt-0.5 text-xs ${preco ? 'text-slate-500' : 'text-amber-700'}`}>{preco || 'não escolhido'}</div>
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
        className={`${classeInput} ${compacto ? 'h-16' : 'h-24'} text-xs`}
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
