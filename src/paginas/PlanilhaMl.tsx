// Planilha do ML: recebe a planilha "Anunciar em massa" que o Mercado Livre devolve depois de receber os EANs,
// faz o DE-PARA pelo EAN com os itens aprovados e devolve a planilha preenchida (regras em docs/regras-planilha-ml.md).
import { useMemo, useState } from 'react';
import { precoDoAnuncio, ROTULO_ANUNCIO } from '../componentes/FotosMl';
import { Botao, Cartao, Etiqueta } from '../componentes/ui';
import { useLinhas, type Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { erroDe } from '../dados/supabase';
import { gravarLinha, lerPlanilhaMl, montarXlsx, normalizarEan, regrasDaLinha, type AbaMl, type LinhaProduto, type PlanilhaMl } from '../nucleo/planilhaMl';
import { LIMITE_TITULO, sugerirTitulo } from '../nucleo/titulo';
import { brl } from '../util/formato';
import { baixar } from '../util/exportar';
import { Foto } from './Produtos';

interface LinhaPrevia {
  chave: string; // aba + linha
  aba: AbaMl;
  prod: LinhaProduto;
  candidatos: Linha[];
}

/** Título que vai para o ML: o título salvo no item; sem título salvo, o sugerido pelo sistema. */
export function tituloDoItem(l: Linha): string {
  return (l.anot?.titulo || sugerirTitulo(l.item.q > 1 ? l.item.nome : l.item.produto.nome, l.item.q)).replace(/\s+/g, ' ').trim();
}

const separarFotos = (t: string | null | undefined) => String(t || '').split(/[\s,;]+/).filter(Boolean);

export function PlanilhaMlPagina() {
  const linhas = useLinhas();
  const { avisar, anotar } = useDados();
  const [arquivo, setArquivo] = useState<{ nome: string; pl: PlanilhaMl } | null>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({}); // chave -> id do item ('' = não preencher)
  const [lendo, setLendo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [gerados, setGerados] = useState<Linha[] | null>(null);

  // DE-PARA: EAN -> itens aprovados (os não publicados primeiro)
  const porEan = useMemo(() => {
    const m = new Map<string, Linha[]>();
    for (const l of linhas.porId.values()) {
      if (l.situacao !== 'aprovado') continue;
      const e = normalizarEan(l.item.produto.ean);
      if (!e) continue;
      if (!m.has(e)) m.set(e, []);
      m.get(e)!.push(l);
    }
    for (const lista of m.values()) lista.sort((a, b) => Number(!!a.anot?.publicadoEm) - Number(!!b.anot?.publicadoEm) || Number(!a.anot?.anuncio) - Number(!b.anot?.anuncio) || b.item.q - a.item.q);
    return m;
  }, [linhas.porId]);

  const previa: LinhaPrevia[] = useMemo(() => {
    if (!arquivo) return [];
    const out: LinhaPrevia[] = [];
    for (const aba of arquivo.pl.abas) {
      for (const prod of aba.produtos) {
        const vistos = new Set<string>();
        const candidatos: Linha[] = [];
        for (const e of prod.eans) for (const l of porEan.get(normalizarEan(e)) || []) if (!vistos.has(l.id)) { vistos.add(l.id); candidatos.push(l); }
        out.push({ chave: `${aba.nome}#${prod.linha}`, aba, prod, candidatos });
      }
    }
    return out;
  }, [arquivo, porEan]);

  const itemDe = (p: LinhaPrevia): Linha | undefined => {
    const id = escolha[p.chave] ?? p.candidatos[0]?.id ?? '';
    return p.candidatos.find((c) => c.id === id);
  };

  const preenchimentos = useMemo(() => previa.map((p) => {
    const l = itemDe(p);
    if (!l) return { p, l, r: null };
    const tipo = l.anot?.anuncio || linhas.ctx.config.tipoAnuncioPadrao;
    const preco = tipo === 'premium' ? l.a.premium.preco : l.a.classico.preco;
    const r = regrasDaLinha(p.aba, {
      titulo: tituloDoItem(l),
      fotos: separarFotos(l.anot?.fotos),
      sku: l.item.produto.sku,
      preco,
      tipo: tipo === 'premium' ? 'Premium' : 'Clássico',
      q: l.item.q,
    }, LIMITE_TITULO);
    if (!l.anot?.anuncio) r.avisos.unshift(`Tipo de anúncio não escolhido: usado o padrão (${ROTULO_ANUNCIO[tipo]}).`);
    if (l.anot?.publicadoEm) r.avisos.unshift('Este item já está em Publicados.');
    const env = l.a.alertas.find((a) => a.tipo === 'Envio')?.restricao;
    if (env) r.avisos.unshift(`Produto na blacklist do Mercado Envios (${env.classe} · ${env.nome}, "${env.termo}"): o ML pode recusar o envio.`);
    if (l.foraDaLista) r.avisos.unshift('Item fora da lista do fornecedor (indisponível ou saiu da planilha).');
    if (p.candidatos.length > 1) r.avisos.unshift(`${p.candidatos.length} itens aprovados têm este EAN: confira se é o certo.`);
    return { p, l, r };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [previa, escolha, linhas.ctx]);

  const prontos = preenchimentos.filter((x) => x.r);
  const semItem = preenchimentos.filter((x) => !x.r);
  const comAviso = prontos.filter((x) => x.r!.avisos.length);

  async function ler(f: File | undefined) {
    if (!f) return;
    setErro(null); setArquivo(null); setEscolha({}); setGerados(null); setLendo(true);
    try {
      const pl = await lerPlanilhaMl(await f.arrayBuffer());
      if (!pl.abas.length) throw new Error('Não achei nenhuma aba de categoria com a coluna "Código universal de produto". Envie a planilha "Anunciar em massa" que o Mercado Livre devolveu.');
      setArquivo({ nome: f.name, pl });
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setLendo(false);
    }
  }

  async function gerar() {
    if (!arquivo) return;
    setGerando(true); setErro(null);
    try {
      const textos = new Map<string, string>();
      const dec = new TextDecoder();
      for (const { p, r } of prontos) {
        const caminho = p.aba.caminho;
        const xml = textos.get(caminho) ?? dec.decode(arquivo.pl.arquivos.get(caminho)!);
        textos.set(caminho, gravarLinha(xml, p.prod.linha, r!.valores));
      }
      const blob = await montarXlsx(arquivo.pl, textos);
      baixar(blob, arquivo.nome.replace(/\.xlsx?$/i, '') + '-PREENCHIDA.xlsx');
      setGerados(prontos.map((x) => x.l!).filter((l) => !l.anot?.publicadoEm));
      avisar(`Planilha gerada: ${prontos.length} produto(s) preenchido(s).`);
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setGerando(false);
    }
  }

  async function marcarPublicados() {
    if (!gerados?.length) return;
    if (!window.confirm(`Mover os ${gerados.length} itens preenchidos de Aprovados para Publicados?`)) return;
    try {
      const agora = new Date().toISOString();
      // um envio por item, porque cada um guarda o próprio preço
      for (const l of gerados) await anotar(l.id, { publicadoEm: agora, precoPublicado: precoDoAnuncio(l) ?? (linhas.ctx.config.tipoAnuncioPadrao === 'premium' ? l.a.premium.preco : l.a.classico.preco) });
      avisar(`${gerados.length} itens movidos para Publicados.`);
      setGerados([]);
    } catch (e) {
      setErro(erroDe(e));
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Planilha do Mercado Livre</h1>
        <p className="mt-1 text-sm text-slate-600">
          Envie a planilha <b>Anunciar em massa</b> que o ML devolveu depois de receber os EANs. O sistema acha cada produto pelo EAN
          e devolve a mesma planilha preenchida (título, fotos, SKU, preço, tipo de anúncio, envio e garantia). As regras estão em <code>docs/regras-planilha-ml.md</code>.
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); ler(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center ${arrastando ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'}`}
      >
        <input type="file" accept=".xlsx,.xls" className="sr-only" data-testid="arquivo-ml" onChange={(e) => { ler(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="text-base font-medium">{lendo ? 'Lendo a planilha…' : 'Arraste a planilha do ML aqui ou clique para escolher'}</span>
        <span className="text-sm text-slate-500">A leitura e o preenchimento são feitos no seu navegador.</span>
      </label>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>}

      {arquivo && (
        <Cartao
          titulo={<>{arquivo.nome} <Etiqueta cor="azul">{previa.length} produtos</Etiqueta></>}
          acoes={<>
            <Botao onClick={() => { setArquivo(null); setGerados(null); }} disabled={gerando}>Cancelar</Botao>
            <Botao variante="primario" onClick={gerar} disabled={gerando || !prontos.length} data-testid="gerar-planilha">{gerando ? 'Gerando…' : `Baixar planilha preenchida (${prontos.length})`}</Botao>
          </>}
        >
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <Etiqueta cor="verde">{prontos.length} serão preenchidos</Etiqueta>
            {comAviso.length > 0 && <Etiqueta cor="laranja">{comAviso.length} com aviso</Etiqueta>}
            {semItem.length > 0 && <Etiqueta cor="vermelho">{semItem.length} sem item aprovado com o EAN</Etiqueta>}
          </div>

          {gerados && gerados.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Planilha baixada. Depois de subir no ML, mova os itens para Publicados:
              <Botao pequeno variante="primario" onClick={marcarPublicados} data-testid="marcar-publicados">Marcar {gerados.length} como publicados</Botao>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm" data-testid="previa-ml">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Aba do ML · EAN</th>
                  <th className="py-2 pr-3 font-medium">Item do sistema</th>
                  <th className="py-2 pr-3 font-medium">Título que vai</th>
                  <th className="py-2 pr-3 text-right font-medium">Preço</th>
                  <th className="py-2 pr-3 font-medium">Avisos</th>
                </tr>
              </thead>
              <tbody>
                {preenchimentos.map(({ p, l, r }) => (
                  <tr key={p.chave} className="border-b border-slate-100 align-top" data-testid="linha-previa">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{p.aba.nome}</div>
                      <div className="text-xs text-slate-500">linha {p.prod.linha} · {p.prod.eans.join(', ') || 'sem EAN'}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {p.candidatos.length === 0 ? <span className="text-red-700">Nenhum item aprovado com este EAN — a linha não é alterada.</span> : (
                        <div className="flex items-start gap-2">
                          {l && <Foto url={l.item.produto.imagemUrl} classe="h-10 w-10 shrink-0" />}
                          <div className="min-w-0">
                            {p.candidatos.length > 1 ? (
                              <select className="max-w-[260px] rounded border border-slate-300 px-1 py-0.5 text-sm" value={escolha[p.chave] ?? p.candidatos[0].id}
                                onChange={(e) => setEscolha((s) => ({ ...s, [p.chave]: e.target.value }))} aria-label="Escolher o item">
                                {p.candidatos.map((c) => <option key={c.id} value={c.id}>{c.item.nome}{c.anot?.publicadoEm ? ' (publicado)' : ''}</option>)}
                                <option value="">Não preencher esta linha</option>
                              </select>
                            ) : <div className="font-medium">{l?.item.nome}</div>}
                            {l && <div className="text-xs text-slate-500">SKU {l.item.produto.sku} · {l.item.q > 1 ? `kit de ${l.item.q}` : 'unidade'} · {separarFotos(l.anot?.fotos).length} fotos</div>}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">{l ? <>{tituloDoItem(l)} <span className={`text-xs ${tituloDoItem(l).length > LIMITE_TITULO ? 'text-red-700' : 'text-slate-400'}`}>({tituloDoItem(l).length})</span></> : <span className="text-slate-400">—</span>}</td>
                    <td className="num py-2 pr-3 text-right">{l ? <>{brl((l.anot?.anuncio || linhas.ctx.config.tipoAnuncioPadrao) === 'premium' ? l.a.premium.preco : l.a.classico.preco)}<div className="text-xs text-slate-500">{ROTULO_ANUNCIO[l.anot?.anuncio || linhas.ctx.config.tipoAnuncioPadrao]}</div></> : '—'}</td>
                    <td className="py-2 pr-3 text-xs">
                      {r && r.avisos.length ? <ul className="list-disc pl-4 text-amber-800">{r.avisos.map((a) => <li key={a}>{a}</li>)}</ul> : r ? <span className="text-emerald-700">ok</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}
    </div>
  );
}
