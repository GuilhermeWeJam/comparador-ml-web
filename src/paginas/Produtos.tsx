// Tela Produtos: abas Produtos (lista única) e Kits recomendados, com filtros, ordenação, colunas e ações em lote.
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Comparar } from '../componentes/Comparar';
import { Detalhe } from '../componentes/Detalhe';
import { FilaPesquisa } from '../componentes/FilaPesquisa';
import { MontarKit } from '../componentes/MontarKit';
import { NovoProduto } from '../componentes/NovoProduto';
import { Botao, classeInput, Etiqueta, NotaBadge, VereditoBadge } from '../componentes/ui';
import { useLinhas, type Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { VEREDITOS } from '../nucleo/analise';
import { urlBusca } from '../nucleo/itens';
import { QTDS_KIT } from '../nucleo/kits';
import { exportar } from '../util/exportar';
import { brl, pct } from '../util/formato';
import { useRota } from '../util/rota';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ORDENS: Record<string, { rotulo: string; valor: (l: Linha) => number | string; dir: 'asc' | 'desc' }> = {
  triagem: { rotulo: 'Nota de triagem', valor: (l) => l.a.triagem.total, dir: 'desc' },
  decisao: { rotulo: 'Nota de decisão', valor: (l) => (l.d ? l.d.nota.total : -1), dir: 'desc' },
  lucro: { rotulo: 'Lucro (Clássico)', valor: (l) => l.a.classico.conta.lucro, dir: 'desc' },
  margem: { rotulo: 'Margem na referência', valor: (l) => l.d?.conta?.margem ?? -9, dir: 'desc' },
  folga: { rotulo: 'Folga de preço', valor: (l) => (l.d && Number.isFinite(l.d.folga) ? l.d.folga : -9), dir: 'desc' },
  custo: { rotulo: 'Custo', valor: (l) => l.item.custo, dir: 'asc' },
  preco: { rotulo: 'Preço de venda', valor: (l) => l.a.classico.preco, dir: 'asc' },
  vendidos: { rotulo: 'Vendidos', valor: (l) => l.pesq?.vendidosMaisVendido ?? -1, dir: 'desc' },
  desconto: { rotulo: 'Desconto necessário', valor: (l) => (l.d && Number.isFinite(l.d.desconto) ? l.d.desconto : 9), dir: 'asc' },
  nome: { rotulo: 'Nome', valor: (l) => semAcento(l.item.nome), dir: 'asc' },
};

function filtrar(linhas: Linha[], p: URLSearchParams, aba: string): Linha[] {
  const g = (k: string) => p.get(k) || '';
  const q = semAcento(g('q'));
  const num = (k: string) => (g(k) ? Number(g(k).replace(',', '.')) : NaN);
  const cmin = num('cmin'), cmax = num('cmax'), pmin = num('pmin'), pmax = num('pmax');
  // na aba Aprovados nada é escondido por tamanho: o que foi aprovado fica na lista
  const mostrar = aba === 'aprovados' ? 'todos' : g('mostrar') || 'ativos';
  let out = linhas.filter((l) => {
    const pr = l.item.produto;
    if (mostrar === 'ativos' && (l.situacao === 'reprovado' || l.a.foraDoTamanho)) return false;
    if (mostrar === 'reprovados' && l.situacao !== 'reprovado') return false;
    if (mostrar === 'tamanho' && !l.a.foraDoTamanho) return false;
    if (q && !semAcento(`${l.item.nome} ${pr.sku} ${pr.marca} ${pr.ean}`).includes(q)) return false;
    if (g('cat') && pr.categoria !== g('cat')) return false;
    if (g('ml') && l.a.comissao.categoriaMl !== g('ml')) return false;
    if (g('uf') && pr.uf !== g('uf')) return false;
    if (g('forn') && pr.fornecedor !== g('forn')) return false;
    if (cmin >= 0 && l.item.custo < cmin) return false;
    if (cmax >= 0 && l.item.custo > cmax) return false;
    if (pmin >= 0 && l.a.classico.preco < pmin) return false;
    if (pmax >= 0 && l.a.classico.preco > pmax) return false;
    if (g('tri') && l.a.triagem.faixa !== g('tri')) return false;
    if (g('dec') && (g('dec') === 'sem' ? !!l.d : l.d?.nota.faixa !== g('dec'))) return false;
    if (g('ver') && l.d?.veredito !== g('ver')) return false;
    const sit = g('sit');
    if (sit === 'potencial' && !l.potencial) return false;
    if (sit === 'revisar' && !l.revisar.length) return false;
    if (sit && !['potencial', 'revisar'].includes(sit) && l.situacao !== sit) return false;
    if (g('pesq') && l.statusPesquisa !== g('pesq')) return false;
    const al = g('alerta');
    if (al === 'nenhum' && l.a.alertas.length) return false;
    if (al && al !== 'nenhum' && !l.a.alertas.some((a) => a.tipo === al)) return false;
    const or = g('origem');
    if (or === 'planilha' && pr.origem !== 'planilha') return false;
    if (or === 'manual' && pr.origem !== 'manual') return false;
    if (['novo', 'subiu', 'caiu'].includes(or) && l.mudanca !== or) return false;
    return true;
  });
  if (g('top')) {
    out = [...out].sort((a, b) => (b.d ? b.d.nota.total : b.a.triagem.total) - (a.d ? a.d.nota.total : a.a.triagem.total)).slice(0, Number(g('top')) || 20);
    return out;
  }
  const ordem = ORDENS[g('ordem')] || ORDENS.triagem;
  const dir = (g('dir') || ordem.dir) === 'asc' ? 1 : -1;
  return [...out].sort((a, b) => {
    const va = ordem.valor(a), vb = ordem.valor(b);
    const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return c * dir || a.item.nome.localeCompare(b.item.nome);
  });
}

interface Coluna {
  id: string;
  titulo: string;
  largura: string;
  render: (l: Linha) => ReactNode;
  direita?: boolean;
  fixa?: boolean;
}

const COLUNAS_OCULTAS_PADRAO = ['comissao'];

function lerOcultas(): string[] {
  try { return JSON.parse(localStorage.getItem('colunas-ocultas') || 'null') || COLUNAS_OCULTAS_PADRAO; } catch { return COLUNAS_OCULTAS_PADRAO; }
}

export function Produtos({ aba }: { aba: 'produtos' | 'kits' | 'aprovados' }) {
  const { params, mudarParams } = useRota();
  const dados = useDados();
  const linhas = useLinhas();
  // aprovados: unidades e kits aprovados, inclusive os que ficaram indisponíveis ou saíram da planilha
  const aprovados = useMemo(() => [...linhas.porId.values()].filter((l) => l.situacao === 'aprovado'), [linhas.porId]);
  const base = aba === 'aprovados' ? aprovados : aba === 'kits' ? linhas.kits : linhas.unidades;
  const lista = useMemo(() => filtrar(base, params, aba), [base, params, aba]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [fila, setFila] = useState<string[] | null>(null);
  const [comparar, setComparar] = useState(false);
  const [novo, setNovo] = useState(false);
  const [editar, setEditar] = useState<Linha | null>(null);
  const [kitDe, setKitDe] = useState<Linha | null>(null);
  const [ocultas, setOcultas] = useState<string[]>(lerOcultas);
  const [verFiltros, setVerFiltros] = useState(() => window.innerWidth >= 768);
  const idDetalhe = params.get('item');
  const detalhe = idDetalhe ? linhas.porId.get(idDetalhe) : undefined;

  useEffect(() => { try { localStorage.setItem('colunas-ocultas', JSON.stringify(ocultas)); } catch { /* sem armazenamento */ } }, [ocultas]);
  // lembra o último filtro de cada aba (restaura só ao abrir a aba sem filtros no endereço)
  const restaurado = useRef<string | null>(null);
  useEffect(() => {
    const chave = `filtro-${aba}`;
    const p = new URLSearchParams(params);
    p.delete('item');
    if (restaurado.current !== aba) {
      restaurado.current = aba;
      if ([...p.keys()].length === 0) {
        try {
          const salvo = localStorage.getItem(chave);
          if (salvo) { mudarParams(Object.fromEntries(new URLSearchParams(salvo))); return; }
        } catch { /* sem armazenamento */ }
      }
    }
    try { localStorage.setItem(chave, p.toString()); } catch { /* sem armazenamento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, params.toString()]);

  function iniciarFila(ids: string[]) {
    if (!ids.length) { dados.avisar('Nenhum item para pesquisar nesta lista.'); return; }
    const l = linhas.porId.get(ids[0]);
    if (l) window.open(urlBusca(l.item), 'busca-ml');
    setFila(ids);
  }
  const pendentes = lista.filter((l) => l.statusPesquisa === 'pendente' || l.statusPesquisa === 'vencida').map((l) => l.id);

  const colunas: Coluna[] = [
    { id: 'sel', titulo: '', largura: '34px', fixa: true, render: (l) => (
      <input type="checkbox" aria-label="Selecionar para comparar" checked={selecionados.includes(l.id)}
        onChange={(e) => setSelecionados((s) => (e.target.checked ? [...s, l.id].slice(-4) : s.filter((x) => x !== l.id)))} onClick={(e) => e.stopPropagation()} />
    ) },
    { id: 'foto', titulo: '', largura: '48px', render: (l) => <Foto url={l.item.produto.imagemUrl} classe="h-10 w-10" /> },
    { id: 'produto', titulo: 'Produto', largura: 'minmax(280px,2.4fr)', fixa: true, render: (l) => <CelulaProduto l={l} anotar={dados.anotar} /> },
    ...(aba === 'kits' ? [{ id: 'unidades', titulo: 'Unidades', largura: '92px', render: (l: Linha) => (
      <select className="rounded border border-slate-300 px-1 py-0.5 text-sm" value={l.item.q} onClick={(e) => e.stopPropagation()}
        onChange={(e) => dados.anotar(l.item.sku, { kitQtd: Number(e.target.value), kitMontado: l.tipoKit === 'montado' })} aria-label="Unidades no kit">
        {QTDS_KIT.map((q) => <option key={q} value={q}>{q} un.</option>)}
      </select>
    ) }] : []),
    { id: 'custo', titulo: 'Custo', largura: '96px', direita: true, render: (l) => <><div>{brl(l.item.custo)}</div>{l.item.q > 1 && <div className="text-xs text-slate-500">{l.item.q} × {brl(l.item.custoUnit)}</div>}{l.mudanca === 'subiu' && <div className="text-xs text-red-700">▲ subiu</div>}{l.mudanca === 'caiu' && <div className="text-xs text-emerald-700">▼ caiu</div>}</> },
    { id: 'comissao', titulo: 'Comissão', largura: '96px', direita: true, render: (l) => <span title={l.a.comissao.categoriaMl}>{pct(l.a.comissao.classico)}<br /><span className="text-xs text-slate-500">{pct(l.a.comissao.premium)}</span></span> },
    { id: 'frete', titulo: 'Frete ML', largura: '84px', direita: true, render: (l) => <span title="Frete no preço Clássico">{brl(l.a.classico.conta.envio)}</span> },
    { id: 'classico', titulo: 'Venda Clássico', largura: '112px', direita: true, render: (l) => <><div className="font-medium">{brl(l.a.classico.preco)}</div><div className="text-xs text-slate-500">lucro {brl(l.a.classico.conta.lucro)}</div></> },
    { id: 'premium', titulo: 'Venda Premium', largura: '112px', direita: true, render: (l) => <><div className="font-medium">{brl(l.a.premium.preco)}</div><div className="text-xs text-slate-500">lucro {brl(l.a.premium.conta.lucro)}</div></> },
    ...(aba === 'kits' ? [{ id: 'um', titulo: 'Comprando 1', largura: '104px', direita: true, render: (l: Linha) => {
      const rec = linhas.unidades.find((u) => u.item.sku === l.item.sku);
      return <><div>{brl(rec?.a.classico.preco)}</div><div className="text-xs text-slate-500">no kit {brl(l.a.classico.preco / l.item.q)}/un.</div></>;
    } }] : []),
    { id: 'triagem', titulo: 'Triagem', largura: '76px', render: (l) => <NotaBadge nota={l.a.triagem} /> },
    { id: 'concorrente', titulo: 'Concorrente', largura: '116px', direita: true, render: (l) => <CelulaConcorrente l={l} pesquisar={() => iniciarFila([l.id])} /> },
    { id: 'margem', titulo: 'Margem ref.', largura: '84px', direita: true, render: (l) => (l.d?.conta ? <span className={l.d.conta.margem < dados.config.margemMinima ? 'text-red-700' : ''}>{pct(l.d.conta.margem)}</span> : <span className="text-slate-400">—</span>) },
    { id: 'decisao', titulo: 'Decisão', largura: '76px', render: (l) => <NotaBadge nota={l.d?.nota} /> },
    { id: 'veredito', titulo: 'Veredito', largura: '108px', render: (l) => <VereditoBadge veredito={l.d?.veredito} motivo={l.d?.motivo} /> },
  ];
  const visiveis = colunas.filter((c) => c.fixa || !ocultas.includes(c.id));
  const grade = visiveis.map((c) => c.largura).join(' ');

  const scroller = useRef<HTMLDivElement>(null);
  const menuExportar = useRef<HTMLDetailsElement>(null);
  const virtual = useVirtualizer({ count: lista.length, getScrollElement: () => scroller.current, estimateSize: () => 76, overscan: 12, getItemKey: (i: number) => lista[i].id });

  const selLinhas = selecionados.map((id) => linhas.porId.get(id)).filter(Boolean) as Linha[];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{aba === 'aprovados' ? 'Aprovados' : aba === 'kits' ? 'Kits recomendados' : 'Produtos'}</h1>
          <p className="text-sm text-slate-600">
            {aba === 'aprovados'
              ? 'Tudo o que vocês aprovaram, unidades e kits. Abra um item para ver a conta, ajustar o preço ou desfazer a decisão.'
              : aba === 'kits'
              ? 'Produtos que vendem melhor em 2 ou mais unidades: o kit divide o custo fixo de envio. Troque a quantidade na linha.'
              : 'Só produtos disponíveis. Comece pela nota de triagem e pesquise o concorrente dos melhores.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="primario" onClick={() => iniciarFila(pendentes.slice(0, 100))} disabled={!pendentes.length} title="Monta a fila com os itens desta lista ainda não pesquisados (ou com pesquisa vencida), na ordem atual">
            Pesquisar estes ({Math.min(pendentes.length, 100)})
          </Botao>
          <Botao onClick={() => setComparar(true)} disabled={selLinhas.length < 2}>Comparar ({selLinhas.length})</Botao>
          {aba === 'produtos' && <Botao onClick={() => setNovo(true)}>Novo produto</Botao>}
          <details className="relative" ref={menuExportar}>
            <summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-slate-50">Exportar ▾</summary>
            <div className="absolute right-0 z-20 mt-1 grid w-60 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {([['Aprovados', aprovados, 'aprovados'], ['Esta lista', lista, aba === 'kits' ? 'kits' : 'produtos']] as [string, Linha[], string][]).filter(([rot]) => aba !== 'aprovados' || rot === 'Aprovados').flatMap(([rot, itens, nome]) =>
                (['xlsx', 'csv'] as const).map((fmt) => (
                  <button key={rot + fmt} type="button" className="rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                    onClick={() => { exportar(itens, fmt, nome); if (menuExportar.current) menuExportar.current.open = false; }}>
                    {rot} ({itens.length}) · .{fmt}
                  </button>
                )))}
            </div>
          </details>
        </div>
      </div>

      <Filtros aba={aba} base={base} params={params} mudar={mudarParams} aberto={verFiltros} alternar={() => setVerFiltros((v) => !v)} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-slate-600"><b className="text-slate-900">{lista.length.toLocaleString('pt-BR')}</b> de {base.length.toLocaleString('pt-BR')} itens{params.get('top') && ' (Top 20)'}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Botao pequeno variante={params.get('top') ? 'primario' : 'secundario'} onClick={() => mudarParams({ top: params.get('top') ? null : '20' })}>★ Top 20</Botao>
          <label className="flex items-center gap-1.5">Ordenar:
            <select className="rounded border border-slate-300 px-1.5 py-1" value={params.get('ordem') || 'triagem'} onChange={(e) => mudarParams({ ordem: e.target.value, dir: null, top: null })}>
              {Object.entries(ORDENS).map(([k, o]) => <option key={k} value={k}>{o.rotulo}</option>)}
            </select>
          </label>
          <button type="button" className="rounded border border-slate-300 px-2 py-1" title="Inverter a ordem"
            onClick={() => { const o = ORDENS[params.get('ordem') || 'triagem'] || ORDENS.triagem; const atual = params.get('dir') || o.dir; mudarParams({ dir: atual === 'asc' ? 'desc' : 'asc' }); }}>
            {(params.get('dir') || (ORDENS[params.get('ordem') || 'triagem'] || ORDENS.triagem).dir) === 'asc' ? '↑' : '↓'}
          </button>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded border border-slate-300 px-2 py-1">Colunas ▾</summary>
            <div className="absolute right-0 z-20 mt-1 grid w-52 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {colunas.filter((c) => !c.fixa).map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-1 py-0.5">
                  <input type="checkbox" checked={!ocultas.includes(c.id)} onChange={(e) => setOcultas((o) => (e.target.checked ? o.filter((x) => x !== c.id) : [...o, c.id]))} />
                  {c.titulo || 'Foto'}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div ref={scroller} className="h-[calc(100vh-300px)] min-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-white" data-testid="tabela">
        <div style={{ minWidth: 1180 }}>
          <div className="sticky top-0 z-10 grid items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600" style={{ gridTemplateColumns: grade }}>
            {visiveis.map((c) => <div key={c.id} className={c.direita ? 'text-right' : ''}>{c.titulo}</div>)}
          </div>
          {lista.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">Nenhum item com esses filtros.</div>
          ) : (
            <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
              {virtual.getVirtualItems().map((v) => {
                const l = lista[v.index];
                return (
                  <div
                    key={l.id}
                    data-index={v.index}
                    ref={virtual.measureElement}
                    role="row"
                    tabIndex={0}
                    onClick={() => mudarParams({ item: l.id })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) mudarParams({ item: l.id }); }}
                    className={`absolute left-0 grid w-full cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm hover:bg-blue-50/50 ${idDetalhe === l.id ? 'bg-blue-50' : ''}`}
                    style={{ transform: `translateY(${v.start}px)`, gridTemplateColumns: grade }}
                  >
                    {visiveis.map((c) => <div key={c.id} className={`num min-w-0 ${c.direita ? 'text-right' : ''}`}>{c.render(l)}</div>)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {detalhe && <Detalhe key={detalhe.id} linha={detalhe} ctx={linhas.ctx} fechar={() => mudarParams({ item: null })} aoMontarKit={() => setKitDe(detalhe)} aoEditar={() => setEditar(detalhe)} />}
      {fila && <FilaPesquisa ids={fila} porId={linhas.porId} fechar={() => setFila(null)} abrirDetalhe={(id) => mudarParams({ item: id })} />}
      {comparar && <Comparar linhas={selLinhas} fechar={() => setComparar(false)} />}
      {novo && <NovoProduto ctx={linhas.ctx} fechar={() => setNovo(false)} />}
      {editar && <NovoProduto ctx={linhas.ctx} editar={editar.item.produto} fechar={() => setEditar(null)} />}
      {kitDe && <MontarKit linha={kitDe} ctx={linhas.ctx} fechar={() => setKitDe(null)} />}
    </div>
  );
}

/** Foto do fornecedor; se não carregar, mostra só o fundo cinza (sem o ícone de imagem quebrada). */
export function Foto({ url, classe }: { url: string; classe: string }) {
  return (
    <div className={`${classe} overflow-hidden rounded border border-slate-200 bg-slate-100`}>
      {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
    </div>
  );
}

const SIT: Record<string, { rotulo: string; cor: string }> = {
  aprovado: { rotulo: 'Aprovado', cor: 'verde' },
  reprovado: { rotulo: 'Reprovado', cor: 'vermelho' },
  adiado: { rotulo: 'Adiado', cor: 'laranja' },
};

function CelulaProduto({ l, anotar }: { l: Linha; anotar: (id: string, m: { potencial: boolean }) => Promise<void> }) {
  const p = l.item.produto;
  const alertas = l.a.alertas.filter((a) => a.nivel !== 'info');
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        <button type="button" className={`shrink-0 leading-none ${l.potencial ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`} title={l.potencial ? 'Potencial (clique para tirar)' : 'Marcar como potencial'}
          onClick={(e) => { e.stopPropagation(); anotar(l.id, { potencial: !l.potencial }); }} aria-label="Potencial">{l.potencial ? '★' : '☆'}</button>
        <span className="line-clamp-2 font-medium leading-snug" title={l.item.nome}>{l.item.nome}</span>
      </div>
      <div className="mt-0.5 truncate text-xs text-slate-500">{p.sku} · {p.categoria || '—'} · {p.fornecedor || '—'}{p.uf ? ` (${p.uf})` : ''}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {SIT[l.situacao] && <Etiqueta cor={SIT[l.situacao].cor}>{SIT[l.situacao].rotulo}</Etiqueta>}
        {l.revisar.length > 0 && <Etiqueta cor="vermelho" titulo={l.revisar.join('\n')}>Revisar</Etiqueta>}
        {l.kitRec && <Etiqueta cor="roxo" titulo={l.kitRec.motivos.join('\n')}>Melhor em kit de {l.kitRec.q}</Etiqueta>}
        {l.tipoKit === 'montado' && <Etiqueta cor="roxo">montado por vocês</Etiqueta>}
        {p.origem === 'manual' && <Etiqueta cor="azul">manual</Etiqueta>}
        {l.mudanca === 'novo' && <Etiqueta cor="azul">novo</Etiqueta>}
        {alertas.slice(0, 2).map((a) => <Etiqueta key={a.tipo} cor={a.nivel === 'bloqueio' ? 'vermelho' : 'laranja'} titulo={a.texto}>{a.tipo}</Etiqueta>)}
      </div>
    </div>
  );
}

function CelulaConcorrente({ l, pesquisar }: { l: Linha; pesquisar: () => void }) {
  if (l.statusPesquisa === 'pendente')
    return <button type="button" className="rounded border border-blue-300 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); pesquisar(); }}>Pesquisar</button>;
  if (l.pesq?.naoEncontrado) return <span className="text-xs text-slate-500">não encontrado{l.statusPesquisa === 'vencida' ? ' · vencida' : ''}</span>;
  return (
    <div>
      <div>{brl(l.d?.precoRef)}</div>
      <div className="text-xs text-slate-500">{l.d?.origemRef === 'mais_vendido' ? 'mais vendido' : 'menor preço'}{l.statusPesquisa === 'vencida' && <span className="text-amber-700"> · vencida</span>}</div>
    </div>
  );
}

function Filtros({ base, params, mudar, aberto, alternar, aba }: {
  aba: string; base: Linha[]; params: URLSearchParams; mudar: (m: Record<string, string | null>) => void; aberto: boolean; alternar: () => void;
}) {
  const { comissoes } = useDados();
  const g = (k: string) => params.get(k) || '';
  const categorias = useMemo(() => [...new Set(base.map((l) => l.item.produto.categoria).filter(Boolean))].sort(), [base]);
  const ufs = useMemo(() => [...new Set(base.map((l) => l.item.produto.uf).filter(Boolean))].sort(), [base]);
  const fornecedores = useMemo(() => [...new Set(base.filter((l) => !g('uf') || l.item.produto.uf === g('uf')).map((l) => l.item.produto.fornecedor).filter(Boolean))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, params.get('uf')]);
  const alertas = useMemo(() => [...new Set(base.flatMap((l) => l.a.alertas.map((a) => a.tipo)))].sort(), [base]);
  const ativos = [...params.keys()].filter((k) => !['item', 'ordem', 'dir', 'top'].includes(k)).length;
  const sel = (k: string, rotulo: string, opcoes: [string, string][], vazio = 'Todos') => (
    <label className="grid gap-1 text-xs text-slate-600">{rotulo}
      <select className={`${classeInput} ${g(k) ? 'border-blue-400 bg-blue-50' : ''}`} value={g(k)} onChange={(e) => mudar({ [k]: e.target.value, ...(k === 'uf' ? { forn: null } : {}), top: null })} data-filtro={k}>
        <option value="">{vazio}</option>
        {opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
    </label>
  );
  const faixa = (kmin: string, kmax: string, rotulo: string) => (
    <div className="grid gap-1 text-xs text-slate-600">{rotulo}
      <div className="flex gap-1">
        <input className={classeInput} inputMode="decimal" placeholder="de" value={g(kmin)} onChange={(e) => mudar({ [kmin]: e.target.value })} data-filtro={kmin} />
        <input className={classeInput} inputMode="decimal" placeholder="até" value={g(kmax)} onChange={(e) => mudar({ [kmax]: e.target.value })} data-filtro={kmax} />
      </div>
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className={`${classeInput} max-w-md flex-1`} placeholder="Buscar por nome, SKU, marca ou EAN" value={g('q')} onChange={(e) => mudar({ q: e.target.value })} data-filtro="q" />
        <button type="button" className="text-sm text-blue-700" onClick={alternar}>{aberto ? 'Esconder filtros' : 'Mostrar filtros'}{ativos ? ` (${ativos} ativos)` : ''}</button>
        {ativos > 0 && <button type="button" className="text-sm text-slate-600 underline" onClick={() => mudar(Object.fromEntries([...params.keys()].filter((k) => k !== 'item').map((k) => [k, null])))}>Limpar filtros</button>}
      </div>
      {aberto && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {sel('cat', 'Categoria', categorias.map((c) => [c, c]))}
          {sel('ml', 'Comissão ML', [...comissoes.values()].map((c) => [c.categoriaMl, `${c.categoriaMl} · ${pct(c.classico)}`]))}
          {sel('uf', 'Estado do fornecedor', ufs.map((u) => [u, u]))}
          {sel('forn', 'Fornecedor', fornecedores.map((f) => [f, f]))}
          {faixa('cmin', 'cmax', 'Custo (R$)')}
          {faixa('pmin', 'pmax', 'Preço de venda Clássico (R$)')}
          {sel('tri', 'Nota de triagem', [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']])}
          {sel('dec', 'Nota de decisão', [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa'], ['sem', 'Sem pesquisa']])}
          {sel('ver', 'Veredito', Object.entries(VEREDITOS).map(([k, v]) => [k, v.rotulo]))}
          {sel('sit', 'Decisão', [['sem_decisao', 'Sem decisão'], ['potencial', '★ Potencial'], ['aprovado', 'Aprovado'], ['adiado', 'Adiado'], ['reprovado', 'Reprovado'], ['revisar', 'Revisar']])}
          {sel('pesq', 'Pesquisa', [['pendente', 'Pendente'], ['feita', 'Feita'], ['vencida', 'Vencida'], ['nao_encontrado', 'Não encontrado']])}
          {sel('alerta', 'Alertas', [['nenhum', 'Sem alerta'], ...alertas.map((a) => [a, a] as [string, string])])}
          {sel('origem', 'Origem e mudanças', [['planilha', 'Da planilha'], ['manual', 'Criados à mão'], ['novo', 'Novos na última importação'], ['subiu', 'Custo subiu'], ['caiu', 'Custo caiu']])}
          {aba !== 'aprovados' && sel('mostrar', 'Mostrar', [['reprovados', 'Só reprovados'], ['tamanho', 'Só acima do tamanho'], ['todos', 'Tudo (inclui reprovados e grandes)']], 'Ativos (padrão)')}
        </div>
      )}
    </div>
  );
}
