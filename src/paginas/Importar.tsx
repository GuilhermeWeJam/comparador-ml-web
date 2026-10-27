import { useState, type ReactNode } from 'react';
import { Botao, Cartao, Etiqueta, Numero } from '../componentes/ui';
import { gravarImportacao, linkDoArquivo, prepararImportacao, type Preparacao } from '../dados/importacao';
import { useDados } from '../dados/store';
import { erroDe } from '../dados/supabase';
import { brl, data, nomeCurto } from '../util/formato';
import { navegar } from '../util/rota';

export function Importar() {
  const { categorias, importacoes, recarregar, avisar, produtos } = useDados();
  const [prep, setPrep] = useState<Preparacao | null>(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState<{ texto: string; fracao: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  async function ler(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setPrep(null);
    setLendo(true);
    try {
      setPrep(await prepararImportacao(arquivo, new Set(categorias.keys())));
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setLendo(false);
    }
  }

  async function gravar() {
    if (!prep) return;
    setErro(null);
    try {
      await gravarImportacao(prep, (texto, fracao) => setGravando({ texto, fracao }));
      await recarregar();
      avisar(`Importação gravada: ${prep.resumo.disponiveis.toLocaleString('pt-BR')} produtos disponíveis.`);
      setPrep(null);
      navegar('produtos');
    } catch (e) {
      setErro(erroDe(e));
    } finally {
      setGravando(null);
    }
  }

  async function baixar(caminho: string) {
    const url = await linkDoArquivo(caminho);
    if (url) window.open(url, '_blank', 'noopener');
    else avisar('Não consegui gerar o link do arquivo.');
  }

  const r = prep?.resumo;
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Importar planilha do fornecedor</h1>
        <p className="mt-1 text-sm text-slate-600">
          {produtos.size === 0
            ? 'Comece por aqui: envie a planilha de produtos do fornecedor (modelo com a aba Produtos e 17 colunas).'
            : 'Envie a planilha mais nova. O sistema compara pelo SKU e mostra o que mudou antes de gravar. Pesquisas, decisões, títulos e produtos criados à mão são mantidos.'}
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); ler(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center ${arrastando ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'}`}
      >
        <input type="file" accept=".xlsx" className="sr-only" data-testid="arquivo" onChange={(e) => { ler(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="text-base font-medium">{lendo ? 'Lendo a planilha…' : 'Arraste o arquivo .xlsx aqui ou clique para escolher'}</span>
        <span className="text-sm text-slate-500">A leitura é feita no seu navegador; nada é gravado antes de você confirmar.</span>
      </label>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>}

      {r && (
        <Cartao
          titulo={`Resumo de ${r.nomeArquivo}`}
          acoes={<>
            <Botao onClick={() => setPrep(null)} disabled={!!gravando}>Cancelar</Botao>
            <Botao variante="primario" onClick={gravar} disabled={!!gravando}>{gravando ? 'Gravando…' : 'Gravar importação'}</Botao>
          </>}
        >
          {gravando && (
            <div className="mb-4">
              <div className="mb-1 text-sm text-slate-600">{gravando.texto}</div>
              <div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round(gravando.fracao * 100)}%` }} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Numero valor={r.lidos.toLocaleString('pt-BR')} rotulo="produtos lidos" detalhe={`${r.totalLinhas.toLocaleString('pt-BR')} linhas na planilha`} />
            <Numero valor={r.disponiveis.toLocaleString('pt-BR')} rotulo="disponíveis" detalhe="só estes aparecem nas listas" />
            <Numero valor={r.primeiraVez ? '—' : r.novos.length.toLocaleString('pt-BR')} rotulo="novos" detalhe={r.primeiraVez ? 'primeira importação' : 'não estavam no sistema'} />
            <Numero valor={(r.custoSubiu.length + r.custoCaiu.length).toLocaleString('pt-BR')} rotulo="com custo alterado" detalhe={`${r.custoSubiu.length} subiram, ${r.custoCaiu.length} caíram`} />
          </div>
          <div className="mt-4 grid gap-2">
            <Lista titulo="Custo subiu" cor="vermelho" itens={r.custoSubiu.map((m) => `${m.linha.sku} · ${m.linha.nome} · ${brl(m.antes)} → ${brl(m.linha.custo)}`)} />
            <Lista titulo="Custo caiu" cor="verde" itens={r.custoCaiu.map((m) => `${m.linha.sku} · ${m.linha.nome} · ${brl(m.antes)} → ${brl(m.linha.custo)}`)} />
            <Lista titulo="Ficaram indisponíveis" cor="laranja" itens={r.ficaramIndisponiveis.map((l) => `${l.sku} · ${l.nome}`)} />
            <Lista titulo="Voltaram a ficar disponíveis" cor="verde" itens={r.voltaram.map((l) => `${l.sku} · ${l.nome}`)} />
            <Lista titulo="Saíram da planilha (o histórico fica guardado)" cor="laranja" itens={r.sumiram.map((s) => `${s.sku} · ${s.nome}`)} />
            {!r.primeiraVez && <Lista titulo="Novos" cor="azul" itens={r.novos.map((l) => `${l.sku} · ${l.nome}`)} />}
            <Lista titulo="Categorias novas (usam a comissão padrão até você ligar em Configurações)" cor="laranja" itens={r.categoriasNovas} />
            <Lista titulo="SKUs repetidos (fica a primeira linha)" cor="cinza" itens={r.repetidos} />
            <Lista titulo="Sem peso na planilha (o sistema usa 0,5 kg, ou o peso cúbico se estiver ligado em Configurações)" cor="cinza" itens={r.pesoZero} />
            <Lista titulo="SKU igual ao de um produto criado à mão (a linha da planilha é ignorada)" cor="vermelho" itens={r.conflitosManuais} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {r.pesoEmGramas.toLocaleString('pt-BR')} pesos estavam em gramas e foram convertidos.
            {r.semCusto > 0 && ` ${r.semCusto} linhas sem custo foram ignoradas.`}
          </p>
        </Cartao>
      )}

      <Cartao titulo="Importações anteriores">
        {importacoes.length === 0 ? <p className="text-sm text-slate-500">Nenhuma ainda.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="py-1 pr-3">Data</th><th className="pr-3">Arquivo</th><th className="pr-3">Produtos</th><th className="pr-3">Disponíveis</th><th className="pr-3">Por</th><th /></tr></thead>
              <tbody>
                {importacoes.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3">{data(i.criadoEm, true)}</td>
                    <td className="pr-3">{i.nomeArquivo}</td>
                    <td className="num pr-3">{i.total.toLocaleString('pt-BR')}</td>
                    <td className="num pr-3">{i.disponiveis.toLocaleString('pt-BR')}</td>
                    <td className="pr-3">{nomeCurto(i.criadoPor)}</td>
                    <td className="text-right">{i.arquivo && <Botao pequeno variante="fantasma" onClick={() => baixar(i.arquivo!)}>Baixar original</Botao>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </div>
  );
}

function Lista({ titulo, itens, cor }: { titulo: ReactNode; itens: string[]; cor: string }) {
  if (!itens.length) return null;
  return (
    <details className="rounded-lg border border-slate-200 px-3 py-2">
      <summary className="cursor-pointer text-sm"><Etiqueta cor={cor}>{itens.length.toLocaleString('pt-BR')}</Etiqueta> <span className="ml-1">{titulo}</span></summary>
      <ul className="mt-2 max-h-64 overflow-y-auto text-xs text-slate-600">
        {itens.slice(0, 500).map((t, i) => <li key={i} className="py-0.5">{t}</li>)}
        {itens.length > 500 && <li className="py-0.5 italic">… e mais {itens.length - 500}</li>}
      </ul>
    </details>
  );
}
