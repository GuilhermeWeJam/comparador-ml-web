// Publicados: itens aprovados que já foram anunciados no Mercado Livre. Dá para desfazer e voltar o item para Aprovados.
import { useMemo, useState } from 'react';
import { ROTULO_ANUNCIO, precoDoAnuncio } from '../componentes/FotosMl';
import { Botao, classeInput, Etiqueta } from '../componentes/ui';
import { useLinhas, type Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { brl, data } from '../util/formato';
import { Foto } from './Produtos';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Publicados() {
  const linhas = useLinhas();
  const [busca, setBusca] = useState('');
  const publicados = useMemo(
    () => [...linhas.porId.values()]
      .filter((l) => !!l.anot?.publicadoEm)
      .sort((a, b) => (b.anot!.publicadoEm || '').localeCompare(a.anot!.publicadoEm || '')),
    [linhas.porId],
  );
  const q = semAcento(busca.trim());
  const lista = q ? publicados.filter((l) => semAcento(`${l.item.nome} ${l.item.produto.sku} ${l.item.produto.ean}`).includes(q)) : publicados;

  return (
    <div className="grid gap-3">
      <div>
        <h1 className="text-xl font-semibold">Publicados</h1>
        <p className="text-sm text-slate-600">Itens que vocês já anunciaram no Mercado Livre. Use <b>Voltar para Aprovados</b> para desfazer.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={`${classeInput} max-w-md flex-1`} placeholder="Buscar por nome, SKU ou EAN" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-sm text-slate-600"><b className="text-slate-900">{lista.length.toLocaleString('pt-BR')}</b> de {publicados.length.toLocaleString('pt-BR')} publicados</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm" data-testid="tabela-publicados">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
            <tr>
              <th className="w-[96px] px-3 py-2">Foto</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Tipo de anúncio</th>
              <th className="px-3 py-2 text-right">Valor anunciado</th>
              <th className="px-3 py-2 text-right">Custo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                {publicados.length ? 'Nenhum publicado com essa busca.' : 'Nenhum item publicado ainda. Em Aprovados, escolha Clássico ou Premium e clique em "Adicionar aos publicados".'}
              </td></tr>
            ) : lista.map((l) => <LinhaPublicado key={l.id} l={l} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinhaPublicado({ l }: { l: Linha }) {
  const { anotar, avisar } = useDados();
  const [salvando, setSalvando] = useState(false);
  const p = l.item.produto;
  const tipo = l.anot?.anuncio;
  const valor = l.anot?.precoPublicado ?? precoDoAnuncio(l);
  const atual = precoDoAnuncio(l);
  const mudou = l.anot?.precoPublicado != null && atual != null && Math.abs(atual - l.anot.precoPublicado) > 0.004;

  async function desfazer() {
    if (!window.confirm(`Voltar "${l.item.nome}" para Aprovados?`)) return;
    setSalvando(true);
    try {
      await anotar(l.id, { publicadoEm: null, precoPublicado: null });
      avisar(`${l.item.nome}: voltou para Aprovados.`);
    } catch (e) {
      avisar('Erro ao salvar: ' + (e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <tr className="border-b border-slate-100 align-middle" data-testid="linha-publicado">
      <td className="px-3 py-2"><Foto url={p.imagemUrl} classe="h-18 w-18" ampliar /></td>
      <td className="px-3 py-2">
        <div className="font-medium leading-snug">{l.item.nome}</div>
        <div className="text-xs text-slate-500">SKU {p.sku}{l.item.q > 1 ? ` · kit de ${l.item.q}` : ''} · publicado em {data(l.anot?.publicadoEm, true)}</div>
        {l.situacao !== 'aprovado' && <Etiqueta cor="laranja">a decisão não está mais como aprovado</Etiqueta>}
      </td>
      <td className="px-3 py-2">{tipo ? <Etiqueta cor={tipo === 'premium' ? 'roxo' : 'azul'}>{ROTULO_ANUNCIO[tipo]}</Etiqueta> : <span className="text-slate-400">—</span>}</td>
      <td className="num px-3 py-2 text-right">
        <div className="font-medium">{brl(valor)}</div>
        {mudou && <div className="text-xs text-amber-700" title="O preço calculado hoje é diferente do que foi anunciado">hoje: {brl(atual)}</div>}
      </td>
      <td className="num px-3 py-2 text-right">
        <div>{brl(l.item.custo)}</div>
        {l.item.q > 1 && <div className="text-xs text-slate-500">{l.item.q} × {brl(l.item.custoUnit)}</div>}
      </td>
      <td className="px-3 py-2 text-right">
        <Botao pequeno onClick={desfazer} disabled={salvando} data-testid="desfazer-publicado">Voltar para Aprovados</Botao>
      </td>
    </tr>
  );
}
