// Estado central do site: sessão, dados do Supabase e atualização em tempo real entre os sócios.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CONFIG_PADRAO } from '../nucleo/analise';
import { FRETE_PADRAO } from '../nucleo/frete';
import type { Anotacao, Categoria, ComissaoMl, Configuracoes, Decisao, Pesquisa, Produto, TabelaFrete } from '../nucleo/tipos';
import {
  anotacaoDe, categoriaDe, comissaoDe, configDe, decisaoDe, freteDe, linhaDaAnotacao, linhaDaConfig, linhaDaDecisao,
  linhaDaPesquisa, linhaDoProduto, pesquisaDe, produtoDe,
} from './mapear';
import { erroDe, lerTudo, supabase } from './supabase';

export interface Importacao {
  id: string;
  arquivo: string | null;
  nomeArquivo: string;
  total: number;
  disponiveis: number;
  resumo: Record<string, unknown> | null;
  criadoPor: string;
  criadoEm: string;
}

export interface Dados {
  produtos: Map<string, Produto>;
  /** Produtos aprovados que saíram da lista (ficaram indisponíveis ou sumiram da planilha): vão para Revisar. */
  produtosFora: Map<string, Produto>;
  config: Configuracoes;
  comissoes: Map<string, ComissaoMl>;
  categorias: Map<string, Categoria>;
  tabela: TabelaFrete;
  pesquisas: Pesquisa[];
  decisoes: Decisao[];
  anotacoes: Map<string, Anotacao>;
  importacoes: Importacao[];
}

interface Contexto extends Dados {
  email: string | null | undefined; // undefined = verificando a sessão
  admin: boolean | null;
  carregando: boolean;
  erro: string | null;
  aviso: string | null;
  avisar: (texto: string | null) => void;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
  salvarPesquisa: (p: Pesquisa) => Promise<Pesquisa>;
  decidir: (d: Decisao) => Promise<Decisao>;
  anotar: (itemId: string, mudanca: Partial<Anotacao>) => Promise<void>;
  salvarConfig: (c: Configuracoes) => Promise<void>;
  salvarComissao: (c: ComissaoMl, nomeAntigo?: string) => Promise<void>;
  excluirComissao: (nome: string) => Promise<void>;
  salvarCategoria: (c: Categoria) => Promise<void>;
  salvarFrete: (t: TabelaFrete) => Promise<void>;
  salvarProduto: (p: Produto, novo: boolean) => Promise<void>;
}

const VAZIO: Dados = {
  produtos: new Map(),
  produtosFora: new Map(),
  config: CONFIG_PADRAO,
  comissoes: new Map(),
  categorias: new Map(),
  tabela: FRETE_PADRAO,
  pesquisas: [],
  decisoes: [],
  anotacoes: new Map(),
  importacoes: [],
};

const Ctx = createContext<Contexto | null>(null);

export function useDados(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDados fora do DadosProvider');
  return c;
}

/** Só aparecem no sistema os produtos disponíveis na planilha atual e os criados à mão. */
export const listavel = (p: Produto) => (p.origem === 'manual' ? true : p.disponivel && p.naPlanilha);

const importacaoDe = (r: Record<string, unknown>): Importacao => ({
  id: String(r.id),
  arquivo: (r.arquivo as string) || null,
  nomeArquivo: String(r.nome_arquivo || ''),
  total: Number(r.total || 0),
  disponiveis: Number(r.disponiveis || 0),
  resumo: (r.resumo as Record<string, unknown>) || null,
  criadoPor: String(r.criado_por || ''),
  criadoEm: String(r.criado_em || ''),
});

const porData = <T extends { criadoEm?: string; id?: number }>(a: T, b: T) =>
  (a.criadoEm || '').localeCompare(b.criadoEm || '') || (a.id || 0) - (b.id || 0);

export function DadosProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const timerAviso = useRef<number | undefined>(undefined);
  const dadosRef = useRef<Dados>(dados);
  dadosRef.current = dados;

  const avisar = useCallback((texto: string | null) => {
    setAviso(texto);
    window.clearTimeout(timerAviso.current);
    if (texto) timerAviso.current = window.setTimeout(() => setAviso(null), 5000);
  }, []);

  // ---- sessão ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_ev, sessao) => setEmail(sessao?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // ---- carga ----
  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data: ehAdmin, error: e0 } = await supabase.rpc('eh_admin');
      if (e0) throw e0;
      setAdmin(!!ehAdmin);
      if (!ehAdmin) return;
      const [disp, manuais, pesq, dec, anot, cfg, com, cat, fr, imp] = await Promise.all([
        lerTudo(() => supabase.from('produtos').select('*').eq('disponivel', true).order('sku')),
        lerTudo(() => supabase.from('produtos').select('*').eq('origem', 'manual').order('sku')),
        lerTudo(() => supabase.from('pesquisas').select('*').order('criado_em')),
        lerTudo(() => supabase.from('decisoes').select('*').order('criado_em')),
        lerTudo(() => supabase.from('anotacoes').select('*').order('item_id')),
        supabase.from('configuracoes').select('*').eq('id', 1).maybeSingle(),
        supabase.from('comissoes_ml').select('*').order('categoria_ml'),
        lerTudo(() => supabase.from('categorias').select('*').order('nome')),
        supabase.from('tabela_frete').select('*').eq('id', 1).maybeSingle(),
        supabase.from('importacoes').select('*').order('criado_em', { ascending: false }).limit(20),
      ]);
      for (const r of [cfg, com, fr, imp]) if (r.error) throw r.error;
      const produtos = new Map<string, Produto>();
      for (const r of [...disp, ...manuais]) {
        const p = produtoDe(r as Record<string, unknown>);
        if (listavel(p)) produtos.set(p.sku, p);
      }
      // aprovados que saíram da lista: carrega para a fila Revisar
      const decisoesTodas = (dec as Record<string, unknown>[]).map(decisaoDe).sort(porData);
      const ultima = new Map<string, string>();
      for (const d of decisoesTodas) ultima.set(d.itemId, d.decisao);
      const skusFora = [...new Set([...ultima].filter(([, v]) => v === 'aprovado').map(([id]) => id.split('::kit')[0]))].filter((s) => !produtos.has(s));
      const produtosFora = new Map<string, Produto>();
      for (let i = 0; i < skusFora.length; i += 200) {
        const { data, error } = await supabase.from('produtos').select('*').in('sku', skusFora.slice(i, i + 200));
        if (error) throw error;
        for (const r of data || []) { const p = produtoDe(r); produtosFora.set(p.sku, p); }
      }
      setDados({
        produtos,
        produtosFora,
        pesquisas: (pesq as Record<string, unknown>[]).map(pesquisaDe).sort(porData),
        decisoes: decisoesTodas,
        anotacoes: new Map((anot as Record<string, unknown>[]).map((r) => { const a = anotacaoDe(r); return [a.itemId, a]; })),
        config: configDe(cfg.data),
        comissoes: new Map((com.data || []).map((r: Record<string, unknown>) => { const c = comissaoDe(r); return [c.categoriaMl, c]; })),
        categorias: new Map((cat as Record<string, unknown>[]).map((r) => { const c = categoriaDe(r); return [c.nome, c]; })),
        tabela: freteDe(fr.data) || FRETE_PADRAO,
        importacoes: (imp.data || []).map(importacaoDe),
      });
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (email) recarregar();
    else { setAdmin(null); setDados(VAZIO); }
  }, [email, recarregar]);

  // ---- tempo real: o que o sócio grava aparece aqui ----
  useEffect(() => {
    if (!email || !admin) return;
    const canal = supabase.channel('mudancas');
    const ouvir = (tabela: string, fn: (nova: Record<string, unknown>, velha: Record<string, unknown>, tipo: string) => void) =>
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (p: { new: Record<string, unknown>; old: Record<string, unknown>; eventType: string }) => fn(p.new, p.old, p.eventType));
    ouvir('produtos', (nova, velha, tipo) => setDados((d) => {
      const produtos = new Map(d.produtos);
      const produtosFora = new Map(d.produtosFora);
      if (tipo === 'DELETE') { produtos.delete(String(velha.sku)); produtosFora.delete(String(velha.sku)); }
      else {
        const p = produtoDe(nova);
        if (listavel(p)) { produtos.set(p.sku, p); produtosFora.delete(p.sku); }
        else { produtos.delete(p.sku); produtosFora.set(p.sku, p); }
      }
      return { ...d, produtos, produtosFora };
    }));
    ouvir('pesquisas', (nova, _v, tipo) => setDados((d) => {
      if (tipo !== 'INSERT' || d.pesquisas.some((p) => p.id === nova.id)) return d;
      return { ...d, pesquisas: [...d.pesquisas, pesquisaDe(nova)] };
    }));
    ouvir('decisoes', (nova, _v, tipo) => setDados((d) => {
      if (tipo !== 'INSERT' || d.decisoes.some((p) => p.id === nova.id)) return d;
      return { ...d, decisoes: [...d.decisoes, decisaoDe(nova)] };
    }));
    ouvir('anotacoes', (nova, velha, tipo) => setDados((d) => {
      const anotacoes = new Map(d.anotacoes);
      if (tipo === 'DELETE') anotacoes.delete(String(velha.item_id));
      else { const a = anotacaoDe(nova); anotacoes.set(a.itemId, a); }
      return { ...d, anotacoes };
    }));
    ouvir('configuracoes', (nova) => setDados((d) => ({ ...d, config: configDe(nova) })));
    ouvir('categorias', (nova, velha, tipo) => setDados((d) => {
      const categorias = new Map(d.categorias);
      if (tipo === 'DELETE') categorias.delete(String(velha.nome));
      else { const c = categoriaDe(nova); categorias.set(c.nome, c); }
      return { ...d, categorias };
    }));
    ouvir('comissoes_ml', (nova, velha, tipo) => setDados((d) => {
      const comissoes = new Map(d.comissoes);
      if (tipo === 'DELETE') comissoes.delete(String(velha.categoria_ml));
      else { const c = comissaoDe(nova); comissoes.set(c.categoriaMl, c); }
      return { ...d, comissoes };
    }));
    canal.subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [email, admin]);

  // ---- gravações ----
  const salvarPesquisa = useCallback(async (p: Pesquisa) => {
    const { data, error } = await supabase.from('pesquisas').insert(linhaDaPesquisa(p)).select().single();
    if (error) throw new Error(error.message);
    const salva = pesquisaDe(data);
    setDados((d) => (d.pesquisas.some((x) => x.id === salva.id) ? d : { ...d, pesquisas: [...d.pesquisas, salva] }));
    return salva;
  }, []);

  const decidir = useCallback(async (dec: Decisao) => {
    const { data, error } = await supabase.from('decisoes').insert(linhaDaDecisao(dec)).select().single();
    if (error) throw new Error(error.message);
    const salva = decisaoDe(data);
    setDados((d) => (d.decisoes.some((x) => x.id === salva.id) ? d : { ...d, decisoes: [...d.decisoes, salva] }));
    return salva;
  }, []);

  const anotar = useCallback(async (itemId: string, mudanca: Partial<Anotacao>) => {
    const atual = dadosRef.current.anotacoes.get(itemId) || { itemId, potencial: false, titulo: null, kitQtd: null, kitMontado: false };
    const nova: Anotacao = { ...atual, ...mudanca, itemId };
    setDados((d) => {
      const anotacoes = new Map(d.anotacoes);
      anotacoes.set(itemId, nova);
      return { ...d, anotacoes };
    });
    const { error } = await supabase.from('anotacoes').upsert(linhaDaAnotacao(nova), { onConflict: 'item_id' });
    if (error) {
      setDados((d) => { const anotacoes = new Map(d.anotacoes); anotacoes.set(itemId, atual); return { ...d, anotacoes }; });
      throw new Error(error.message);
    }
  }, []);

  const salvarConfig = useCallback(async (c: Configuracoes) => {
    const { error } = await supabase.from('configuracoes').update(linhaDaConfig(c)).eq('id', 1);
    if (error) throw new Error(error.message);
    setDados((d) => ({ ...d, config: c }));
  }, []);

  const salvarComissao = useCallback(async (c: ComissaoMl, nomeAntigo?: string) => {
    const linha = { categoria_ml: c.categoriaMl, classico: c.classico, premium: c.premium, padrao: c.padrao };
    const q = nomeAntigo && nomeAntigo !== c.categoriaMl
      ? supabase.from('comissoes_ml').update(linha).eq('categoria_ml', nomeAntigo)
      : supabase.from('comissoes_ml').upsert(linha, { onConflict: 'categoria_ml' });
    const { error } = await q;
    if (error) throw new Error(error.message);
    if (c.padrao) {
      // só uma linha pode ser o padrão
      const outras = [...dadosRef.current.comissoes.values()].filter((x) => x.padrao && x.categoriaMl !== c.categoriaMl && x.categoriaMl !== nomeAntigo);
      for (const o of outras) await supabase.from('comissoes_ml').update({ padrao: false }).eq('categoria_ml', o.categoriaMl);
    }
    setDados((d) => {
      const comissoes = new Map(d.comissoes);
      if (nomeAntigo) comissoes.delete(nomeAntigo);
      if (c.padrao) for (const [k, v] of comissoes) comissoes.set(k, { ...v, padrao: false });
      comissoes.set(c.categoriaMl, c);
      const categorias = new Map(d.categorias);
      if (nomeAntigo && nomeAntigo !== c.categoriaMl)
        for (const [k, v] of categorias) if (v.categoriaMl === nomeAntigo) categorias.set(k, { ...v, categoriaMl: c.categoriaMl });
      return { ...d, comissoes, categorias };
    });
  }, []);

  const excluirComissao = useCallback(async (nome: string) => {
    const { error } = await supabase.from('comissoes_ml').delete().eq('categoria_ml', nome);
    if (error) throw new Error(error.message);
    setDados((d) => {
      const comissoes = new Map(d.comissoes);
      comissoes.delete(nome);
      const categorias = new Map(d.categorias);
      for (const [k, v] of categorias) if (v.categoriaMl === nome) categorias.set(k, { ...v, categoriaMl: null });
      return { ...d, comissoes, categorias };
    });
  }, []);

  const salvarCategoria = useCallback(async (c: Categoria) => {
    const { error } = await supabase.from('categorias').upsert({ nome: c.nome, categoria_ml: c.categoriaMl, epoca: c.epoca }, { onConflict: 'nome' });
    if (error) throw new Error(error.message);
    setDados((d) => { const categorias = new Map(d.categorias); categorias.set(c.nome, c); return { ...d, categorias }; });
  }, []);

  const salvarFrete = useCallback(async (t: TabelaFrete) => {
    const { error } = await supabase.from('tabela_frete').upsert({ id: 1, versao: t.versao || 'editada', fonte: 'editada no sistema', preco_ini: t.precoIni, peso_ini: t.pesoIni, valores: t.valores }, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    setDados((d) => ({ ...d, tabela: t }));
  }, []);

  const salvarProduto = useCallback(async (p: Produto, novo: boolean) => {
    const linha = linhaDoProduto(p);
    const { data, error } = novo
      ? await supabase.from('produtos').insert({ ...linha, origem: 'manual', na_planilha: false }).select().single()
      : await supabase.from('produtos').update(linha).eq('sku', p.sku).select().single();
    if (error) throw new Error(error.message);
    const salvo = produtoDe(data);
    setDados((d) => {
      const produtos = new Map(d.produtos);
      if (listavel(salvo)) produtos.set(salvo.sku, salvo); else produtos.delete(salvo.sku);
      return { ...d, produtos };
    });
  }, []);

  const sair = useCallback(async () => { await supabase.auth.signOut(); setEmail(null); }, []);

  const valor = useMemo<Contexto>(() => ({
    ...dados, email, admin, carregando, erro, aviso, avisar, recarregar, sair, salvarPesquisa, decidir, anotar,
    salvarConfig, salvarComissao, excluirComissao, salvarCategoria, salvarFrete, salvarProduto,
  }), [dados, email, admin, carregando, erro, aviso, avisar, recarregar, sair, salvarPesquisa, decidir, anotar,
    salvarConfig, salvarComissao, excluirComissao, salvarCategoria, salvarFrete, salvarProduto]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
