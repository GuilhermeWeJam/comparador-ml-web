// Painel inicial: métricas de uso, fila Revisar, próximos para pesquisar e última importação.
import { useMemo } from 'react';
import { Botao, Cartao, Etiqueta, NotaBadge, Numero } from '../componentes/ui';
import { useLinhas, type Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { data, nomeCurto, pct } from '../util/formato';
import { montarHash, navegar } from '../util/rota';

const SEMANA = 7 * 864e5;

function tempo(seg: number): string {
  if (!Number.isFinite(seg)) return '—';
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}

const abrir = (l: Linha) => navegar(l.item.q > 1 ? 'kits' : 'produtos', { item: l.id });

export function Inicio() {
  const { pesquisas, decisoes, importacoes } = useDados();
  const linhas = useLinhas();

  const m = useMemo(() => {
    const agora = Date.now();
    const comTempo = pesquisas.filter((p) => p.origem === 'manual' && p.segundosGastos && p.segundosGastos < 3600).slice(-50);
    const tempoMedio = comTempo.length ? comTempo.reduce((s, p) => s + (p.segundosGastos || 0), 0) / comTempo.length : NaN;
    const pesquisadosSemana = new Set(pesquisas.filter((p) => agora - Date.parse(p.criadoEm || '') < SEMANA).map((p) => p.itemId)).size;
    const aprovadosSemana = new Set(decisoes.filter((d) => d.decisao === 'aprovado' && agora - Date.parse(d.criadoEm || '') < SEMANA).map((d) => d.itemId)).size;
    const todas = [...linhas.unidades, ...linhas.kits];
    const comD = todas.filter((l) => l.d);
    const acerto = (f: 'alta' | 'baixa') => {
      const g = comD.filter((l) => l.a.triagem.faixa === f);
      return { n: g.length, taxa: g.length ? g.filter((l) => l.d!.veredito === 'anunciar' || l.d!.veredito === 'testar').length / g.length : NaN };
    };
    const aprovados = todas.filter((l) => l.situacao === 'aprovado');
    return {
      tempoMedio, nTempo: comTempo.length, pesquisadosSemana, aprovadosSemana, alta: acerto('alta'), baixa: acerto('baixa'),
      vencidas: aprovados.filter((l) => l.statusPesquisa === 'vencida').length,
      aprovadosUnit: aprovados.filter((l) => l.item.q === 1).length,
      aprovadosKit: aprovados.filter((l) => l.item.q > 1).length,
      pesquisados: todas.filter((l) => l.pesq).length,
    };
  }, [pesquisas, decisoes, linhas]);

  const proximos = useMemo(
    () => linhas.unidades
      .filter((l) => l.statusPesquisa === 'pendente' && l.situacao === 'sem_decisao' && !l.a.foraDoTamanho && !l.a.restrito)
      .sort((a, b) => b.a.triagem.total - a.a.triagem.total)
      .slice(0, 10),
    [linhas.unidades],
  );
  const ultima = importacoes[0];

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Início</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Numero valor={linhas.unidades.length.toLocaleString('pt-BR')} rotulo="produtos disponíveis" detalhe={`${linhas.kits.length} kits recomendados ou montados`} />
        <Numero valor={m.pesquisados.toLocaleString('pt-BR')} rotulo="itens pesquisados" detalhe={`${m.pesquisadosSemana} nos últimos 7 dias`} />
        <Numero valor={(m.aprovadosUnit + m.aprovadosKit).toLocaleString('pt-BR')} rotulo="aprovados" detalhe={`${m.aprovadosUnit} unitários, ${m.aprovadosKit} kits · ${m.aprovadosSemana} na semana`} />
        <Numero valor={tempo(m.tempoMedio)} rotulo="tempo médio por pesquisa" detalhe={m.nTempo ? `últimas ${m.nTempo} pesquisas` : 'ainda sem pesquisas'} />
        <Numero valor={`${pct(m.alta.taxa)} × ${pct(m.baixa.taxa)}`} rotulo="acerto da triagem"
          detalhe={`viram Anunciar/Testar: triagem alta (${m.alta.n}) × baixa (${m.baixa.n}). A primeira deve ser maior.`} />
        <Numero valor={m.vencidas} rotulo="pesquisas vencidas" detalhe="entre os aprovados" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo={<>Revisar <Etiqueta cor={linhas.revisar.length ? 'vermelho' : 'cinza'}>{linhas.revisar.length}</Etiqueta></>}>
          {linhas.revisar.length === 0 ? <p className="text-sm text-slate-500">Nada para revisar. Aqui aparecem aprovados com custo maior, indisponíveis, que saíram da planilha ou com pesquisa vencida, e itens adiados cuja data chegou.</p> : (
            <ul className="grid gap-2">
              {linhas.revisar.slice(0, 30).map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{l.item.nome}</div>
                    <div className="text-xs text-red-700">{l.revisar.join(' · ')}</div>
                  </div>
                  {!l.foraDaLista && <Botao pequeno onClick={() => abrir(l)}>Abrir</Botao>}
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Próximos para pesquisar" acoes={<a className="text-sm text-blue-700" href={montarHash('produtos', { pesq: 'pendente', ordem: 'triagem' })}>Ver todos pendentes</a>}>
          {proximos.length === 0 ? <p className="text-sm text-slate-500">Nenhum produto pendente.</p> : (
            <ul className="grid gap-1.5">
              {proximos.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <button type="button" className="min-w-0 truncate text-left hover:underline" onClick={() => abrir(l)}>{l.item.nome}</button>
                  <NotaBadge nota={l.a.triagem} />
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Última importação" acoes={<a className="text-sm text-blue-700" href={montarHash('importar')}>Importar planilha nova</a>}>
        {ultima ? (
          <p className="text-sm">
            {data(ultima.criadoEm, true)} · {ultima.nomeArquivo} · {ultima.total.toLocaleString('pt-BR')} produtos, {ultima.disponiveis.toLocaleString('pt-BR')} disponíveis · por {nomeCurto(ultima.criadoPor)}
          </p>
        ) : <p className="text-sm text-slate-500">Nenhuma importação ainda.</p>}
      </Cartao>
    </div>
  );
}
