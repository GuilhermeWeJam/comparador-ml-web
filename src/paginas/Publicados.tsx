// Publicados: itens aprovados que já foram anunciados no Mercado Livre. Dá para desfazer e voltar o item para Aprovados.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertaEnvio } from '../componentes/AlertaEnvio';
import { ROTULO_ANUNCIO, precoDoAnuncio } from '../componentes/FotosMl';
import { Botao, classeInput, Etiqueta } from '../componentes/ui';
import { premissasPara, type Contexto } from '../nucleo/analise';
import { contaVenda } from '../nucleo/calc';
import { useLinhas, type Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { brl, data, kg, pct } from '../util/formato';
import { useRota } from '../util/rota';
import { Foto } from './Produtos';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Publicados() {
  const linhas = useLinhas();
  const { params, mudarParams } = useRota();
  const [busca, setBusca] = useState('');
  const publicados = useMemo(
    () => [...linhas.porId.values()]
      .filter((l) => !!l.anot?.publicadoEm)
      .sort((a, b) => (b.anot!.publicadoEm || '').localeCompare(a.anot!.publicadoEm || '')),
    [linhas.porId],
  );
  // duas abas, igual em Aprovados: Unidades (1 unidade) e Kits (2 ou mais)
  const tipoAba = params.get('tipo') === 'kits' ? 'kits' : 'unidades';
  const pubUnidades = publicados.filter((l) => l.item.q === 1);
  const pubKits = publicados.filter((l) => l.item.q > 1);
  const daAba = tipoAba === 'kits' ? pubKits : pubUnidades;
  const q = semAcento(busca.trim());
  const aberto = params.get('item') ? publicados.find((l) => l.id === params.get('item')) : undefined;
  const lista = q ? daAba.filter((l) => semAcento(`${l.item.nome} ${l.item.produto.sku} ${l.item.produto.ean}`).includes(q)) : daAba;

  return (
    <div className="grid gap-3">
      <div>
        <h1 className="text-xl font-semibold">Publicados</h1>
        <p className="text-sm text-slate-600">Itens que vocês já anunciaram no Mercado Livre. Use <b>Voltar para Aprovados</b> para desfazer.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Tipo de item publicado">
        {([['unidades', 'Unidades', pubUnidades.length], ['kits', 'Kits', pubKits.length]] as [string, string, number][]).map(([v, rot, n]) => (
          <button key={v} type="button" role="tab" aria-selected={tipoAba === v} data-testid={`aba-pub-${v}`}
            onClick={() => mudarParams({ tipo: v === 'unidades' ? null : v, item: null })}
            className={`-mb-px rounded-t-lg border px-4 py-2 text-sm ${tipoAba === v ? 'border-slate-200 border-b-white bg-white font-semibold text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            {rot} <Etiqueta cor={tipoAba === v ? 'azul' : 'cinza'}>{n}</Etiqueta>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={`${classeInput} max-w-md flex-1`} placeholder="Buscar por nome, SKU ou EAN" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-sm text-slate-600"><b className="text-slate-900">{lista.length.toLocaleString('pt-BR')}</b> de {daAba.length.toLocaleString('pt-BR')} {tipoAba === 'kits' ? 'kits' : 'unidades'} publicados</span>
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
                {daAba.length ? 'Nenhum publicado com essa busca.' : publicados.length ? `Nenhum${tipoAba === 'kits' ? ' kit' : 'a unidade'} publicad${tipoAba === 'kits' ? 'o' : 'a'} ainda.` : 'Nenhum item publicado ainda. Em Aprovados, escolha Clássico ou Premium e clique em "Adicionar aos publicados".'}
              </td></tr>
            ) : lista.map((l) => <LinhaPublicado key={l.id} l={l} abrir={() => mudarParams({ item: l.id })} />)}
          </tbody>
        </table>
      </div>

      {aberto && <DetalhePublicado key={aberto.id} l={aberto} ctx={linhas.ctx} fechar={() => mudarParams({ item: null })} />}
    </div>
  );
}

function LinhaPublicado({ l, abrir }: { l: Linha; abrir: () => void }) {
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
    <tr className="cursor-pointer border-b border-slate-100 align-middle hover:bg-blue-50/50" data-testid="linha-publicado" onClick={abrir} title="Ver a conta da venda">
      <td className="px-3 py-2"><Foto url={p.imagemUrl} classe="h-18 w-18" ampliar /></td>
      <td className="px-3 py-2">
        <div className="font-medium leading-snug">{l.item.nome} <AlertaEnvio alertas={l.a.alertas} /></div>
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
        <Botao pequeno onClick={(e) => { e.stopPropagation(); desfazer(); }} disabled={salvando} data-testid="desfazer-publicado">Voltar para Aprovados</Botao>
      </td>
    </tr>
  );
}

/** Painel do item publicado: só a conta do tipo de anúncio em que ele está sendo vendido. */
function DetalhePublicado({ l, ctx, fechar }: { l: Linha; ctx: Contexto; fechar: () => void }) {
  const { anotar, avisar } = useDados();
  const p = l.item.produto;
  const tipo = l.anot?.anuncio || null;
  const comissao = tipo === 'premium' ? l.a.comissao.premium : l.a.comissao.classico;
  const preco = l.anot?.precoPublicado ?? precoDoAnuncio(l);
  const conta = tipo && preco ? contaVenda(preco, l.item.custo, l.item.peso, premissasPara(ctx.config, comissao), ctx.tabela) : null;
  const atual = precoDoAnuncio(l);
  const mudou = l.anot?.precoPublicado != null && atual != null && Math.abs(atual - l.anot.precoPublicado) > 0.004;
  const fotos = (l.anot?.fotos || '').split(/[\s,;]+/).filter(Boolean);

  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [fechar]);

  async function desfazer() {
    if (!window.confirm(`Voltar "${l.item.nome}" para Aprovados?`)) return;
    try {
      await anotar(l.id, { publicadoEm: null, precoPublicado: null });
      avisar(`${l.item.nome}: voltou para Aprovados.`);
      fechar();
    } catch (e) {
      avisar('Erro ao salvar: ' + (e as Error).message);
    }
  }

  const linhasConta: [string, ReactNode, string?][] = conta ? [
    ['Preço anunciado', <b>{brl(conta.preco)}</b>],
    ['Custo', brl(conta.custo), l.item.q > 1 ? `${l.item.q} × ${brl(l.item.custoUnit)}` : undefined],
    [`Comissão (${pct(comissao)})`, brl(conta.comissao), l.a.comissao.categoriaMl],
    ['Frete ML', brl(conta.envio), `peso para frete ${kg(l.item.peso)}`],
    [`Imposto (${pct(ctx.config.imposto)})`, brl(conta.imposto)],
    [`Reserva (${pct(ctx.config.reserva)})`, brl(conta.reserva)],
    ['Lucro por venda', <b className={conta.lucro < 0 ? 'text-red-700' : 'text-emerald-700'}>{brl(conta.lucro)}</b>],
    ['Margem', pct(conta.margem)],
    [`Margem com Ads (−${pct(ctx.config.ads)})`, pct(conta.margemAds)],
  ] : [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <aside role="dialog" aria-label={`Detalhe de ${l.item.nome}`} className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" data-testid="detalhe-publicado">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <Foto url={p.imagemUrl} classe="h-16 w-16 shrink-0" ampliar />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug">{l.item.nome}</h2>
            <p className="text-xs text-slate-500">SKU {p.sku}{l.item.q > 1 ? ` · kit de ${l.item.q}` : ''} · {p.categoria || 'sem categoria'} · {p.fornecedor || '—'}{p.uf ? ` (${p.uf})` : ''}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Etiqueta cor="verde">Publicado</Etiqueta>
              {tipo && <Etiqueta cor={tipo === 'premium' ? 'roxo' : 'azul'}>{ROTULO_ANUNCIO[tipo]}</Etiqueta>}
              <span className="text-xs text-slate-500">em {data(l.anot?.publicadoEm, true)}</span>
            </div>
          </div>
          <button type="button" onClick={fechar} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">✕</button>
        </div>

        <section className="px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Conta da venda {tipo ? `no ${ROTULO_ANUNCIO[tipo]}` : ''}</h3>
          {!conta ? <p className="text-sm text-slate-600">Este item não tem tipo de anúncio escolhido. Volte para Aprovados e escolha Clássico ou Premium.</p> : (
            <table className="w-full text-sm" data-testid="conta-publicado">
              <tbody>
                {linhasConta.map(([rot, val, det]) => (
                  <tr key={rot} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">{rot}{det && <div className="text-xs text-slate-400">{det}</div>}</td>
                    <td className="num py-1.5 text-right">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {mudou && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">O preço calculado hoje para este item é {brl(atual)} (o custo ou as premissas mudaram depois da publicação). A conta acima usa o preço anunciado.</p>}
        </section>

        <section className="border-t border-slate-200 px-5 py-4 text-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Dados do anúncio</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div><dt className="text-xs text-slate-500">EAN</dt><dd>{p.ean || '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Fotos para o ML</dt><dd>{fotos.length ? `${fotos.length} links` : '—'}</dd></div>
            {l.anot?.titulo && <div className="col-span-2"><dt className="text-xs text-slate-500">Título salvo</dt><dd>{l.anot.titulo}</dd></div>}
          </dl>
        </section>

        <div className="border-t border-slate-200 px-5 py-4">
          <Botao onClick={desfazer}>Voltar para Aprovados</Botao>
        </div>
      </aside>
    </div>
  );
}
