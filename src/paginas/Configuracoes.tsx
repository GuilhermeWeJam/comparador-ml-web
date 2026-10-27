// Configurações: premissas, regra de tamanho, pesos das notas, comissões do ML, categorias e época, frete e acesso.
import { useEffect, useMemo, useState } from 'react';
import { Botao, Campo, Cartao, classeInput, Etiqueta } from '../componentes/ui';
import { useDados } from '../dados/store';
import { erroDe, supabase } from '../dados/supabase';
import { PESOS_PADRAO } from '../nucleo/analise';
import { FRETE_PADRAO } from '../nucleo/frete';
import type { ComissaoMl, Configuracoes as Config, Epoca, Pesos, TabelaFrete } from '../nucleo/tipos';
import { lerNumero, pct } from '../util/formato';

const pctTxt = (v: number) => String(Math.round(v * 10000) / 100).replace('.', ',');
const lerPct = (s: string) => lerNumero(s) / 100;

export function Configuracoes() {
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <p className="-mt-2 text-sm text-slate-600">Tudo aqui vale na hora para os dois sócios: os preços, as notas e os vereditos são recalculados.</p>
      <Premissas />
      <PesosNotas />
      <Comissoes />
      <Categorias />
      <Frete />
      <Acesso />
    </div>
  );
}

function usarSalvar() {
  const { avisar } = useDados();
  const [salvando, setSalvando] = useState(false);
  async function salvar(fn: () => Promise<void>, ok: string) {
    setSalvando(true);
    try { await fn(); avisar(ok); } catch (e) { avisar('Erro ao salvar: ' + erroDe(e)); } finally { setSalvando(false); }
  }
  return { salvando, salvar };
}

function Premissas() {
  const { config, salvarConfig } = useDados();
  const [v, setV] = useState(() => paraTexto(config));
  useEffect(() => setV(paraTexto(config)), [config]);
  const { salvando, salvar } = usarSalvar();
  const set = (k: keyof ReturnType<typeof paraTexto>) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? !!e.target.checked : e.target.value }));
  const novo: Config = {
    ...config,
    margemDesejada: lerPct(v.margemDesejada), margemMinima: lerPct(v.margemMinima), imposto: lerPct(v.imposto), reserva: lerPct(v.reserva), ads: lerPct(v.ads),
    tipoAnuncioPadrao: v.tipo === 'premium' ? 'premium' : 'classico', ocultarAcimaDoLado: v.ocultar, ladoMaxCm: lerNumero(v.lado), validadePesquisaDias: Math.round(lerNumero(v.validade)), pesoFreteModo: v.pesoModo === 'cubico' ? 'cubico' : 'real',
  };
  const valido = [novo.margemDesejada, novo.margemMinima, novo.imposto, novo.reserva, novo.ads].every((x) => x >= 0 && x < 0.9) && novo.ladoMaxCm > 0 && novo.validadePesquisaDias > 0 && novo.margemMinima <= novo.margemDesejada;
  return (
    <Cartao titulo="Premissas e regra de tamanho" acoes={<Botao variante="primario" disabled={!valido || salvando} onClick={() => salvar(() => salvarConfig(novo), 'Premissas salvas.')}>Salvar</Botao>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
        <Campo rotulo="Margem desejada (%)" dica="define o preço de venda"><input className={classeInput} value={v.margemDesejada} onChange={set('margemDesejada')} data-campo="margemDesejada" /></Campo>
        <Campo rotulo="Margem mínima (%)" dica="abaixo disso, não compensa"><input className={classeInput} value={v.margemMinima} onChange={set('margemMinima')} /></Campo>
        <Campo rotulo="Imposto (%)" dica="Simples Nacional"><input className={classeInput} value={v.imposto} onChange={set('imposto')} /></Campo>
        <Campo rotulo="Reserva (%)" dica="devoluções e imprevistos"><input className={classeInput} value={v.reserva} onChange={set('reserva')} /></Campo>
        <Campo rotulo="Ads (%)" dica="só na “margem com Ads”"><input className={classeInput} value={v.ads} onChange={set('ads')} /></Campo>
        <Campo rotulo="Tipo de anúncio padrão" dica="usado no veredito">
          <select className={classeInput} value={v.tipo} onChange={set('tipo')}><option value="classico">Clássico</option><option value="premium">Premium</option></select>
        </Campo>
        <Campo rotulo="Validade da pesquisa (dias)"><input className={classeInput} value={v.validade} onChange={set('validade')} /></Campo>
        <Campo rotulo="Peso usado no frete" dica="qual peso entra na tabela do ML">
          <select className={classeInput} value={v.pesoModo} onChange={set('pesoModo')} data-campo="pesoModo">
            <option value="real">Só o peso do produto</option>
            <option value="cubico">Maior entre real e cúbico</option>
          </select>
        </Campo>
        <Campo rotulo="Maior lado aceito (cm)">
          <input className={classeInput} value={v.lado} onChange={set('lado')} data-campo="lado" />
        </Campo>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.ocultar} onChange={set('ocultar')} data-campo="ocultar" />
        Não listar itens com algum lado maior que {v.lado || '—'} cm (ficam só no filtro “Mostrar → Só acima do tamanho”)
      </label>
    </Cartao>
  );
}

function paraTexto(c: Config) {
  return {
    margemDesejada: pctTxt(c.margemDesejada), margemMinima: pctTxt(c.margemMinima), imposto: pctTxt(c.imposto), reserva: pctTxt(c.reserva), ads: pctTxt(c.ads),
    tipo: c.tipoAnuncioPadrao as string, ocultar: c.ocultarAcimaDoLado, lado: String(c.ladoMaxCm), validade: String(c.validadePesquisaDias), pesoModo: c.pesoFreteModo as string,
  };
}

const ROTULOS_TRIAGEM: [keyof Pesos['triagem'], string][] = [['lucro', 'Lucro por venda'], ['frete', 'Peso do frete'], ['logistica', 'Logística'], ['risco', 'Risco'], ['epoca', 'Época'], ['comissao', 'Comissão']];
const ROTULOS_DECISAO: [keyof Pesos['decisao'], string][] = [['margem', 'Margem na referência'], ['demanda', 'Demanda'], ['concorrencia', 'Concorrência'], ['risco', 'Risco e logística']];

function PesosNotas() {
  const { config, salvarConfig } = useDados();
  const [p, setP] = useState<Pesos>(config.pesos);
  useEffect(() => setP(config.pesos), [config.pesos]);
  const { salvando, salvar } = usarSalvar();
  const somaT = Object.values(p.triagem).reduce((s, x) => s + x, 0);
  const somaD = Object.values(p.decisao).reduce((s, x) => s + x, 0);
  const n = (v: string) => (Number.isFinite(lerNumero(v)) ? lerNumero(v) : 0);
  return (
    <Cartao titulo="Pesos das notas e limites do veredito" acoes={<>
      <Botao onClick={() => setP(PESOS_PADRAO)}>Voltar ao padrão</Botao>
      <Botao variante="primario" disabled={salvando} onClick={() => salvar(() => salvarConfig({ ...config, pesos: p }), 'Pesos salvos.')}>Salvar</Botao>
    </>}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Nota de triagem <span className={`font-normal ${somaT === 100 ? 'text-slate-500' : 'text-amber-700'}`}>(soma {somaT})</span></h3>
          <div className="grid grid-cols-2 gap-2">
            {ROTULOS_TRIAGEM.map(([k, r]) => <Campo key={k} rotulo={r}><input className={classeInput} value={p.triagem[k]} onChange={(e) => setP({ ...p, triagem: { ...p.triagem, [k]: n(e.target.value) } })} /></Campo>)}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Nota de decisão <span className={`font-normal ${somaD === 100 ? 'text-slate-500' : 'text-amber-700'}`}>(soma {somaD})</span></h3>
          <div className="grid grid-cols-2 gap-2">
            {ROTULOS_DECISAO.map(([k, r]) => <Campo key={k} rotulo={r}><input className={classeInput} value={p.decisao[k]} onChange={(e) => setP({ ...p, decisao: { ...p.decisao, [k]: n(e.target.value) } })} /></Campo>)}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Faixas e veredito</h3>
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Nota alta a partir de"><input className={classeInput} value={p.faixas.alta} onChange={(e) => setP({ ...p, faixas: { ...p.faixas, alta: n(e.target.value) } })} /></Campo>
            <Campo rotulo="Nota média a partir de"><input className={classeInput} value={p.faixas.media} onChange={(e) => setP({ ...p, faixas: { ...p.faixas, media: n(e.target.value) } })} /></Campo>
            <Campo rotulo="Anunciar com nota ≥"><input className={classeInput} value={p.veredito.anunciar} onChange={(e) => setP({ ...p, veredito: { ...p.veredito, anunciar: n(e.target.value) } })} /></Campo>
            <Campo rotulo="Testar com nota ≥"><input className={classeInput} value={p.veredito.testar} onChange={(e) => setP({ ...p, veredito: { ...p.veredito, testar: n(e.target.value) } })} /></Campo>
            <Campo rotulo="Desconto máximo para Renegociar (%)"><input className={classeInput} value={pctTxt(p.veredito.descontoMax)} onChange={(e) => setP({ ...p, veredito: { ...p.veredito, descontoMax: lerPct(e.target.value) || 0 } })} /></Campo>
          </div>
        </div>
      </div>
    </Cartao>
  );
}

function Comissoes() {
  const { comissoes, categorias, salvarComissao, excluirComissao } = useDados();
  const { salvar } = usarSalvar();
  const [nova, setNova] = useState({ nome: '', classico: '', premium: '' });
  const usadas = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of categorias.values()) if (c.categoriaMl) m.set(c.categoriaMl, (m.get(c.categoriaMl) || 0) + 1);
    return m;
  }, [categorias]);
  const lista = [...comissoes.values()].sort((a, b) => Number(a.padrao) - Number(b.padrao) || a.classico - b.classico || a.categoriaMl.localeCompare(b.categoriaMl));
  return (
    <Cartao titulo="Comissões do Mercado Livre por categoria">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Categoria do ML</th><th>Clássico (%)</th><th>Premium (%)</th><th>Padrão</th><th>Categorias ligadas</th><th /></tr></thead>
          <tbody>
            {lista.map((c) => <LinhaComissao key={c.categoriaMl} c={c} ligadas={usadas.get(c.categoriaMl) || 0}
              salvar={(x, antigo) => salvar(() => salvarComissao(x, antigo), 'Comissão salva.')}
              excluir={() => salvar(() => excluirComissao(c.categoriaMl), 'Categoria do ML removida.')} />)}
            <tr className="border-t border-slate-200">
              <td className="py-1.5 pr-2"><input className={classeInput} placeholder="Nova categoria do ML" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></td>
              <td className="pr-2"><input className={`${classeInput} w-24`} value={nova.classico} onChange={(e) => setNova({ ...nova, classico: e.target.value })} /></td>
              <td className="pr-2"><input className={`${classeInput} w-24`} value={nova.premium} onChange={(e) => setNova({ ...nova, premium: e.target.value })} /></td>
              <td />
              <td />
              <td className="text-right"><Botao pequeno disabled={!nova.nome.trim() || !(lerPct(nova.classico) > 0) || !(lerPct(nova.premium) > 0)}
                onClick={() => salvar(async () => { await salvarComissao({ categoriaMl: nova.nome.trim(), classico: lerPct(nova.classico), premium: lerPct(nova.premium), padrao: false }); setNova({ nome: '', classico: '', premium: '' }); }, 'Categoria do ML criada.')}>Adicionar</Botao></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">A linha marcada como padrão vale para as categorias do fornecedor sem ligação. A comissão real é a da categoria em que o anúncio for publicado: confira no ML ao anunciar.</p>
    </Cartao>
  );
}

function LinhaComissao({ c, ligadas, salvar, excluir }: { c: ComissaoMl; ligadas: number; salvar: (c: ComissaoMl, antigo: string) => void; excluir: () => void }) {
  const [v, setV] = useState({ nome: c.categoriaMl, classico: pctTxt(c.classico), premium: pctTxt(c.premium) });
  useEffect(() => setV({ nome: c.categoriaMl, classico: pctTxt(c.classico), premium: pctTxt(c.premium) }), [c]);
  const mudou = v.nome !== c.categoriaMl || lerPct(v.classico) !== c.classico || lerPct(v.premium) !== c.premium;
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 pr-2"><input className={classeInput} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></td>
      <td className="pr-2"><input className={`${classeInput} w-24`} value={v.classico} onChange={(e) => setV({ ...v, classico: e.target.value })} /></td>
      <td className="pr-2"><input className={`${classeInput} w-24`} value={v.premium} onChange={(e) => setV({ ...v, premium: e.target.value })} /></td>
      <td className="pr-2"><input type="radio" name="padrao" checked={c.padrao} onChange={() => salvar({ ...c, padrao: true }, c.categoriaMl)} aria-label="Usar como padrão" /></td>
      <td className="pr-2 text-slate-600">{c.padrao ? 'as sem ligação' : ligadas}</td>
      <td className="whitespace-nowrap text-right">
        {mudou && <Botao pequeno variante="primario" onClick={() => salvar({ categoriaMl: v.nome.trim(), classico: lerPct(v.classico), premium: lerPct(v.premium), padrao: c.padrao }, c.categoriaMl)}>Salvar</Botao>}
        {!c.padrao && <Botao pequeno variante="fantasma" onClick={excluir}>Remover</Botao>}
      </td>
    </tr>
  );
}

function Categorias() {
  const { categorias, comissoes, produtos, salvarCategoria } = useDados();
  const { salvar } = usarSalvar();
  const [soSem, setSoSem] = useState(false);
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of produtos.values()) m.set(p.categoria, (m.get(p.categoria) || 0) + 1);
    return m;
  }, [produtos]);
  const lista = [...categorias.values()].filter((c) => !soSem || !c.categoriaMl).sort((a, b) => a.nome.localeCompare(b.nome));
  const semLigacao = [...categorias.values()].filter((c) => !c.categoriaMl).length;
  return (
    <Cartao titulo={<>Categorias do fornecedor <Etiqueta cor={semLigacao ? 'laranja' : 'verde'}>{semLigacao} sem ligação</Etiqueta></>}
      acoes={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soSem} onChange={(e) => setSoSem(e.target.checked)} /> Só as sem ligação</label>}>
      <p className="mb-2 text-sm text-slate-600">A categoria do ML define a comissão. A época entra na nota de triagem: alta agora = 10 pontos, normal = 5, baixa = 0.</p>
      <div className="max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs text-slate-500"><tr><th className="py-1">Categoria do fornecedor</th><th>Disponíveis</th><th>Categoria do ML (comissão)</th><th>Época</th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.nome} className="border-t border-slate-100">
                <td className="py-1.5 pr-2">{c.nome}</td>
                <td className="num pr-2 text-slate-600">{contagem.get(c.nome) || 0}</td>
                <td className="pr-2">
                  <select className={classeInput} value={c.categoriaMl || ''} data-categoria={c.nome}
                    onChange={(e) => salvar(() => salvarCategoria({ ...c, categoriaMl: e.target.value || null }), `${c.nome}: comissão atualizada.`)}>
                    <option value="">Padrão (sem ligação)</option>
                    {[...comissoes.values()].filter((x) => !x.padrao).map((x) => <option key={x.categoriaMl} value={x.categoriaMl}>{x.categoriaMl} · {pct(x.classico)} / {pct(x.premium)}</option>)}
                  </select>
                </td>
                <td>
                  <select className={classeInput} value={c.epoca} onChange={(e) => salvar(() => salvarCategoria({ ...c, epoca: e.target.value as Epoca }), `${c.nome}: época atualizada.`)}>
                    <option value="alta">Alta agora</option><option value="normal">Normal</option><option value="baixa">Baixa</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

function Frete() {
  const { tabela, salvarFrete } = useDados();
  const [t, setT] = useState<TabelaFrete>(tabela);
  const [aberto, setAberto] = useState(false);
  useEffect(() => setT(tabela), [tabela]);
  const { salvando, salvar } = usarSalvar();
  const faixasPreco = t.precoIni.map((p, i) => (i + 1 < t.precoIni.length ? `R$ ${p} a ${t.precoIni[i + 1] - 0.01}` : `R$ ${p}+`));
  const faixasPeso = t.pesoIni.map((p, i) => (i + 1 < t.pesoIni.length ? `até ${String(Math.round((t.pesoIni[i + 1] - 0.001) * 1000) / 1000).replace('.', ',')} kg` : `mais de ${String(Math.round((p - 0.001) * 1000) / 1000).replace('.', ',')} kg`));
  return (
    <Cartao titulo="Tabela de frete do Mercado Livre" acoes={<>
      <Botao onClick={() => setAberto((a) => !a)}>{aberto ? 'Esconder' : 'Ver e editar'}</Botao>
      {aberto && <Botao onClick={() => setT(FRETE_PADRAO)}>Voltar à tabela oficial de 2026</Botao>}
      {aberto && <Botao variante="primario" disabled={salvando} onClick={() => salvar(() => salvarFrete(t), 'Tabela de frete salva.')}>Salvar</Botao>}
    </>}>
      <p className="text-sm text-slate-600">Versão {tabela.versao || '—'}: custo de envio que o ML desconta do vendedor, pela faixa de peso (conforme a opção “Peso usado no frete” em Premissas) e de preço. Reputação verde ou sem reputação. Abaixo de R$ 19, no máximo metade do preço.</p>
      {aberto && (
        <div className="mt-3 overflow-x-auto">
          <table className="text-xs" key={t.versao}>
            <thead><tr><th className="px-1 py-1 text-left">Peso</th>{faixasPreco.map((f) => <th key={f} className="px-1 py-1 text-right font-medium">{f.replace(/\.99/g, ',99')}</th>)}</tr></thead>
            <tbody>
              {t.valores.map((linha, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-1 text-slate-600">{faixasPeso[i]}</td>
                  {linha.map((v, j) => (
                    <td key={j} className="px-0.5 py-0.5">
                      <input className="w-16 rounded border border-slate-200 px-1 py-0.5 text-right" defaultValue={String(v).replace('.', ',')}
                        onBlur={(e) => { const n = lerNumero(e.target.value); if (n >= 0) setT((x) => ({ ...x, versao: 'editada', valores: x.valores.map((l, a) => (a === i ? l.map((c, b) => (b === j ? n : c)) : l)) })); }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}

function Acesso() {
  const [admins, setAdmins] = useState<{ email: string; nome: string | null }[]>([]);
  useEffect(() => { supabase.from('admins').select('email,nome').then(({ data }) => setAdmins((data as { email: string; nome: string | null }[]) || [])); }, []);
  return (
    <Cartao titulo="Acesso">
      <p className="text-sm text-slate-600">Só estes e-mails Google entram no sistema (no máximo 2). Para trocar, edite a tabela <code className="rounded bg-slate-100 px-1">admins</code> no painel do Supabase (passo a passo no LEIA-ME).</p>
      <ul className="mt-2 text-sm">{admins.map((a) => <li key={a.email}>• {a.email}{a.nome ? ` (${a.nome})` : ''}</li>)}</ul>
    </Cartao>
  );
}
