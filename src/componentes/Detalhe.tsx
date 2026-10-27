// Painel lateral com tudo de um item: conta Clássico × Premium, simulador, notas, pesquisa, decisão, título e dados.
import { useMemo, useState, type ReactNode } from 'react';
import type { Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { premissasPara, VEREDITOS, type Contexto } from '../nucleo/analise';
import { contaVenda, type Conta } from '../nucleo/calc';
import { urlBusca } from '../nucleo/itens';
import { analisarTitulo, LIMITE_TITULO, sugerirTitulo } from '../nucleo/titulo';
import type { Pesquisa } from '../nucleo/tipos';
import { brl, data, kg, lerNumero, nomeCurto, pct } from '../util/formato';
import { Decidir, registrarDecisao, type AcaoDecisao } from './Decidir';
import { FormPesquisa } from './FormPesquisa';
import { Botao, classeInput, Etiqueta, NotaBadge, VereditoBadge } from './ui';

const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  sem_decisao: { rotulo: 'Sem decisão', cor: 'cinza' },
  aprovado: { rotulo: 'Aprovado', cor: 'verde' },
  reprovado: { rotulo: 'Reprovado', cor: 'vermelho' },
  adiado: { rotulo: 'Adiado', cor: 'laranja' },
};

function Secao({ titulo, children, acoes }: { titulo: ReactNode; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="border-t border-slate-200 px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
        {acoes}
      </div>
      {children}
    </section>
  );
}

function TabelaConta({ classico, premium, comissao }: { classico: Conta; premium: Conta; comissao: { classico: number; premium: number } }) {
  const linhas: [string, (c: Conta) => ReactNode, string?][] = [
    ['Preço de venda', (c) => <b>{brl(c.preco)}</b>],
    ['Custo', (c) => brl(c.custo)],
    ['Comissão', (c) => `${brl(c.comissao)}`],
    ['Frete ML', (c) => brl(c.envio)],
    ['Imposto', (c) => brl(c.imposto)],
    ['Reserva', (c) => brl(c.reserva)],
    ['Lucro', (c) => <b className={c.lucro < 0 ? 'text-red-700' : ''}>{brl(c.lucro)}</b>],
    ['Margem', (c) => pct(c.margem)],
    ['Margem com Ads', (c) => pct(c.margemAds)],
  ];
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-slate-500">
        <tr><th className="py-1 text-left font-normal" /><th className="text-right font-medium">Clássico ({pct(comissao.classico)})</th><th className="text-right font-medium">Premium ({pct(comissao.premium)})</th></tr>
      </thead>
      <tbody>
        {linhas.map(([rot, f]) => (
          <tr key={rot} className="border-t border-slate-100">
            <td className="py-1 text-slate-600">{rot}</td>
            <td className="num text-right">{f(classico)}</td>
            <td className="num text-right">{f(premium)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Partes({ nota }: { nota: { partes: { criterio: string; pontos: number; max: number; texto: string }[] } }) {
  return (
    <ul className="grid gap-1 text-sm">
      {nota.partes.map((p) => (
        <li key={p.criterio} className="grid grid-cols-[1fr_auto] gap-2">
          <span><span className="font-medium">{p.criterio}:</span> <span className="text-slate-600">{p.texto}</span></span>
          <span className="num text-slate-700">{p.pontos.toLocaleString('pt-BR')}/{p.max}</span>
        </li>
      ))}
    </ul>
  );
}

function resumoPesquisa(p: Pesquisa): string {
  if (p.naoEncontrado) return 'não encontrado';
  return [
    `menor ${brl(p.menorPreco)}`,
    p.precoMaisVendido ? `mais vendido ${brl(p.precoMaisVendido)}` : '',
    p.vendidosMaisVendido !== null ? `${p.vendidosMaisVendido.toLocaleString('pt-BR')} vendidos` : '',
    p.concorrentes ? `${p.concorrentes.replace('10+', '+10').replace('-', ' a ')} anúncios` : '',
    p.temFull ? 'Full' : '', p.temOficial ? 'oficial' : '',
    p.qtdNoAnuncio ? `anúncio com ${p.qtdNoAnuncio} un.` : '',
  ].filter(Boolean).join(' · ');
}

export function Detalhe({ linha, ctx, fechar, aoMontarKit, aoEditar }: {
  linha: Linha; ctx: Contexto; fechar: () => void; aoMontarKit: () => void; aoEditar: () => void;
}) {
  const { salvarPesquisa, anotar, decidir, avisar, salvarProduto } = useDados();
  const { item, a, d } = linha;
  const p = item.produto;
  const [pesquisando, setPesquisando] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [simulado, setSimulado] = useState('');
  const [decisao, setDecisao] = useState<AcaoDecisao | null>(null);
  const tituloSugerido = useMemo(() => sugerirTitulo(item.q > 1 ? item.nome : p.nome, item.q), [item, p.nome]);
  const [titulo, setTitulo] = useState(linha.anot?.titulo || tituloSugerido);
  const analiseTitulo = useMemo(() => analisarTitulo(titulo, item.q), [titulo, item.q]);

  const precoSim = lerNumero(simulado);
  const sim = precoSim > 0 ? {
    classico: contaVenda(precoSim, item.custo, item.peso, premissasPara(ctx.config, a.comissao.classico), ctx.tabela),
    premium: contaVenda(precoSim, item.custo, item.peso, premissasPara(ctx.config, a.comissao.premium), ctx.tabela),
  } : null;

  function abrirBusca() {
    window.open(urlBusca(item), 'busca-ml');
    setPesquisando(Date.now());
  }

  async function salvar(pq: Pesquisa) {
    setSalvando(true);
    try {
      await salvarPesquisa(pq);
      setPesquisando(null);
      avisar('Pesquisa salva.');
    } finally {
      setSalvando(false);
    }
  }

  async function aprovar() {
    if (linha.d && linha.d.veredito === 'descartar') { setDecisao('aprovado'); return; }
    await registrarDecisao(decidir, linha, 'aprovado');
    avisar(`${item.nome}: aprovado.`);
  }

  const sit = SITUACAO[linha.situacao];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <aside role="dialog" aria-label={`Detalhe de ${item.nome}`} className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" data-testid="detalhe">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-3">
          {p.imagemUrl ? <img src={p.imagemUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug">{item.nome}</h2>
            <p className="text-xs text-slate-500">SKU {p.sku} · {p.categoria || 'sem categoria'} · {p.fornecedor || '—'}{p.uf ? ` (${p.uf})` : ''}{p.origem === 'manual' ? ' · criado à mão' : ''}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Etiqueta cor={sit.cor}>{sit.rotulo}</Etiqueta>
              {linha.potencial && <Etiqueta cor="laranja">★ Potencial</Etiqueta>}
              {linha.revisar.map((r) => <Etiqueta key={r} cor="vermelho">Revisar: {r}</Etiqueta>)}
            </div>
          </div>
          <button type="button" onClick={fechar} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">✕</button>
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-3">
          <Botao variante="primario" onClick={abrirBusca}>Pesquisar no ML</Botao>
          <Botao onClick={() => anotar(item.id, { potencial: !linha.potencial })}>{linha.potencial ? '★ Tirar potencial' : '☆ Marcar potencial'}</Botao>
          <Botao variante="sucesso" onClick={aprovar}>Aprovar {item.q > 1 ? 'kit' : 'unitário'}</Botao>
          <Botao variante="perigo" onClick={() => setDecisao('reprovado')}>Reprovar</Botao>
          <Botao onClick={() => setDecisao('adiado')}>Adiar</Botao>
          {linha.dec && <Botao variante="fantasma" onClick={async () => { await registrarDecisao(decidir, linha, 'desfeita'); avisar('Decisão desfeita.'); }}>Desfazer decisão</Botao>}
          {item.q === 1 && <Botao variante="fantasma" onClick={aoMontarKit}>Montar kit…</Botao>}
        </div>

        {(pesquisando !== null || !linha.pesq) && (
          <Secao titulo={linha.pesq ? 'Nova pesquisa do concorrente' : 'Pesquisa do concorrente'}>
            {pesquisando === null ? (
              <p className="text-sm text-slate-600">Ainda não pesquisado. Clique em <b>Pesquisar no ML</b>: a busca abre numa aba nova e o formulário aparece aqui.</p>
            ) : (
              <FormPesquisa itemId={item.id} q={item.q} anterior={linha.pesq} inicio={pesquisando} aoSalvar={salvar} salvando={salvando} />
            )}
          </Secao>
        )}

        {linha.pesq && d && (
          <Secao titulo={<span className="flex items-center gap-2">Decisão <NotaBadge nota={d.nota} /> <VereditoBadge veredito={d.veredito} motivo={d.motivo} /></span>}
            acoes={pesquisando === null && <Botao pequeno onClick={abrirBusca}>Nova pesquisa</Botao>}>
            <p className="mb-2 text-sm"><b>{VEREDITOS[d.veredito].rotulo}:</b> {d.motivo}</p>
            {Number.isFinite(d.precoRef) && (
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Mini rot="Preço de referência" val={brl(d.precoRef)} det={d.origemRef === 'mais_vendido' ? 'do que mais vende' : 'menor preço'} />
                <Mini rot="Margem Clássico" val={pct(d.contaClassico?.margem)} det={`lucro ${brl(d.contaClassico?.lucro)}`} />
                <Mini rot="Margem Premium" val={pct(d.contaPremium?.margem)} det={`lucro ${brl(d.contaPremium?.lucro)}`} />
                <Mini rot="Folga de preço" val={pct(d.folga)} det={d.folga >= 0 ? 'seu mínimo fica abaixo' : 'seu mínimo fica acima'} />
              </div>
            )}
            {Number.isFinite(d.teto) && d.desconto > 0 && (
              <p className="mb-3 text-sm text-amber-800">Teto de custo para a margem mínima: <b>{brl(d.teto)}</b>. Desconto a pedir ao fornecedor: <b>{pct(d.desconto)}</b>.</p>
            )}
            <Partes nota={d.nota} />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-600">Pesquisas ({linha.pesquisas.length})</summary>
              <ul className="mt-1 grid gap-1 text-xs text-slate-600">
                {[...linha.pesquisas].reverse().map((x) => (
                  <li key={x.id}>{data(x.criadoEm, true)} · {nomeCurto(x.criadoPor)} · {resumoPesquisa(x)}{x.link ? <> · <a className="text-blue-700 underline" href={x.link} target="_blank" rel="noreferrer">anúncio</a></> : null}{x.observacao ? ` · ${x.observacao}` : ''}</li>
                ))}
              </ul>
            </details>
          </Secao>
        )}

        <Secao titulo="Preço de venda e conta">
          <TabelaConta classico={a.classico.conta} premium={a.premium.conta} comissao={a.comissao} />
          <p className="mt-2 text-xs text-slate-500">
            Preço mínimo (margem de {pct(ctx.config.margemMinima)}): Clássico {brl(a.classico.minimo)} · Premium {brl(a.premium.minimo)}.
            Comissão da categoria do ML <b>{a.comissao.categoriaMl}</b>{a.comissao.padrao ? ' (categoria sem ligação: usa o padrão)' : ''}.
          </p>
          <PrecoManual key={`${item.id}-${linha.anot?.precoClassico}-${linha.anot?.precoPremium}`} linha={linha} ctx={ctx} />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="simulador" className="font-medium">Simular preço:</label>
            <input id="simulador" inputMode="decimal" className={`${classeInput} w-32`} value={simulado} onChange={(e) => setSimulado(e.target.value)} placeholder="R$" />
          </div>
          {sim && <div className="mt-2"><TabelaConta classico={sim.classico} premium={sim.premium} comissao={a.comissao} /></div>}
        </Secao>

        <Secao titulo={<span className="flex items-center gap-2">Triagem <NotaBadge nota={a.triagem} /></span>}>
          <Partes nota={a.triagem} />
          {linha.kitRec && (
            <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
              Melhor em kit de {linha.kitRec.q}: {linha.kitRec.motivos.join('; ')}.
            </p>
          )}
        </Secao>

        <Secao titulo="Decisão de vocês">
          {linha.dec ? (
            <p className="text-sm">
              <Etiqueta cor={sit.cor}>{sit.rotulo}</Etiqueta> por {nomeCurto(linha.dec.criadoPor)} em {data(linha.dec.criadoEm, true)}
              {linha.dec.motivo && <> · {linha.dec.motivo}</>}{linha.dec.motivoDetalhe && <> — {linha.dec.motivoDetalhe}</>}
              {linha.dec.revisarEm && <> · rever em {data(linha.dec.revisarEm)}</>}
            </p>
          ) : <p className="text-sm text-slate-600">Ainda sem decisão.</p>}
          {linha.decisoes.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-slate-600">Histórico ({linha.decisoes.length})</summary>
              <ul className="mt-1 grid gap-1 text-xs text-slate-600">
                {[...linha.decisoes].reverse().map((x) => (
                  <li key={x.id}>{data(x.criadoEm, true)} · {nomeCurto(x.criadoPor)} · {x.decisao}{x.motivo ? ` · ${x.motivo}` : ''}{x.vereditoMomento ? ` · veredito era ${VEREDITOS[x.vereditoMomento as keyof typeof VEREDITOS]?.rotulo || x.vereditoMomento}` : ''}{x.custoMomento !== null ? ` · custo ${brl(x.custoMomento)}` : ''}</li>
                ))}
              </ul>
            </details>
          )}
        </Secao>

        <Secao titulo={<span className="flex items-center gap-2">Título sugerido <Etiqueta cor={analiseTitulo.nivel === 'Bom' ? 'verde' : analiseTitulo.nivel === 'Regular' ? 'laranja' : 'vermelho'}>{analiseTitulo.nota}</Etiqueta></span>}
          acoes={<Botao pequeno onClick={async () => { await anotar(item.id, { titulo }); avisar('Título salvo.'); }}>Salvar título</Botao>}>
          <input className={classeInput} value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
          <p className={`mt-1 text-xs ${titulo.length > LIMITE_TITULO ? 'text-red-700' : 'text-slate-500'}`}>{titulo.length} de {LIMITE_TITULO} caracteres{titulo !== tituloSugerido && <> · <button type="button" className="underline" onClick={() => setTitulo(tituloSugerido)}>voltar à sugestão</button></>}</p>
          <ul className="mt-2 grid gap-0.5 text-xs">
            {analiseTitulo.itens.map((i) => <li key={i.texto} className={i.ok ? 'text-slate-600' : 'text-amber-800'}>{i.ok ? '✓' : '✗'} {i.texto}{!i.ok && i.dica ? ` ${i.dica}` : ''}</li>)}
          </ul>
        </Secao>

        <Secao titulo="Dados do produto" acoes={p.origem === 'manual' && (
          <div className="flex gap-2">
            <Botao pequeno onClick={aoEditar}>Editar</Botao>
            <Botao pequeno variante="perigo" onClick={async () => { await salvarProduto({ ...p, ativo: false }, false); avisar('Produto desativado.'); fechar(); }}>Desativar</Botao>
          </div>
        )}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            <Dado rot="Custo" val={<>{brl(item.custo)}{item.q > 1 && <span className="text-slate-500"> ({item.q} × {brl(item.custoUnit)})</span>}</>} />
            {p.custoAnterior !== null && linha.mudanca && <Dado rot="Custo anterior" val={brl(p.custoAnterior * item.q)} />}
            <Dado rot="Peso para frete" val={kg(item.peso)} />
            <Dado rot="Peso real" val={kg(p.pesoKg)} />
            <Dado rot="Medidas (cm)" val={p.dims ? p.dims.map((x) => x.toLocaleString('pt-BR')).join(' × ') : '—'} />
            <Dado rot="Marca" val={p.marca || '—'} />
            <Dado rot="EAN" val={p.ean || '—'} />
            <Dado rot="NCM" val={p.ncm || '—'} />
            <Dado rot="CEST" val={p.cest || '—'} />
          </dl>
          {a.alertas.length > 0 && (
            <ul className="mt-3 grid gap-1 text-sm">
              {a.alertas.map((x) => <li key={x.tipo + x.texto}><Etiqueta cor={x.nivel === 'bloqueio' ? 'vermelho' : x.nivel === 'atencao' ? 'laranja' : 'cinza'}>{x.tipo}</Etiqueta> <span className="text-slate-600">{x.texto}</span></li>)}
            </ul>
          )}
        </Secao>
      </aside>
      {decisao && <Decidir linha={linha} acao={decisao} fechar={() => setDecisao(null)} />}
    </div>
  );
}

/** Edição do preço de venda só deste item: a conta (comissão, frete, imposto, lucro) é refeita com o preço digitado. */
function PrecoManual({ linha, ctx }: { linha: Linha; ctx: Contexto }) {
  const { anotar, avisar } = useDados();
  const { a, anot, item } = linha;
  const [pc, setPc] = useState(anot?.precoClassico ? String(anot.precoClassico).replace('.', ',') : '');
  const [pp, setPp] = useState(anot?.precoPremium ? String(anot.precoPremium).replace('.', ',') : '');
  const [salvando, setSalvando] = useState(false);
  const vc = lerNumero(pc);
  const vp = lerNumero(pp);
  const valido = (s: string, v: number) => s.trim() === '' || v > 0;
  const mudou = (anot?.precoClassico ?? null) !== (vc > 0 ? vc : null) || (anot?.precoPremium ?? null) !== (vp > 0 ? vp : null);
  const editado = a.classico.manual || a.premium.manual;

  async function salvar(novoC: number | null, novoP: number | null, msg: string) {
    setSalvando(true);
    try { await anotar(item.id, { precoClassico: novoC, precoPremium: novoP }); avisar(msg); } catch (e) { avisar('Erro ao salvar: ' + (e as Error).message); } finally { setSalvando(false); }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <div className="mb-1 font-medium">Preço deste produto {editado && <Etiqueta cor="laranja">editado à mão</Etiqueta>}</div>
      <p className="mb-2 text-xs text-slate-500">Digite o preço que quer praticar só neste item. Comissão, frete, imposto, reserva e lucro são recalculados. Em branco = preço calculado pela margem desejada ({pct(ctx.config.margemDesejada)}).</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-0.5 text-xs text-slate-600">Clássico
          <input inputMode="decimal" className={`${classeInput} w-28`} value={pc} onChange={(e) => setPc(e.target.value)} placeholder="calculado" data-campo="precoClassico" />
        </label>
        <label className="grid gap-0.5 text-xs text-slate-600">Premium
          <input inputMode="decimal" className={`${classeInput} w-28`} value={pp} onChange={(e) => setPp(e.target.value)} placeholder="calculado" data-campo="precoPremium" />
        </label>
        <Botao pequeno variante="primario" disabled={salvando || !mudou || !valido(pc, vc) || !valido(pp, vp)} onClick={() => salvar(vc > 0 ? vc : null, vp > 0 ? vp : null, 'Preço salvo.')}>Salvar preço</Botao>
        {editado && <Botao pequeno variante="fantasma" disabled={salvando} onClick={() => { setPc(''); setPp(''); salvar(null, null, 'Voltou ao preço calculado.'); }}>Voltar ao calculado</Botao>}
      </div>
    </div>
  );
}

function Mini({ rot, val, det }: { rot: string; val: ReactNode; det?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="text-xs text-slate-500">{rot}</div>
      <div className="num font-semibold">{val}</div>
      {det && <div className="text-xs text-slate-500">{det}</div>}
    </div>
  );
}

function Dado({ rot, val }: { rot: string; val: ReactNode }) {
  return (<div><dt className="text-xs text-slate-500">{rot}</dt><dd className="num">{val}</dd></div>);
}
