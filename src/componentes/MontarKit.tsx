// Montar kit de qualquer produto: escolhe a quantidade (limitada por 30 kg e pelo tamanho da caixa).
import { useMemo } from 'react';
import type { Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { analisarItem, premissasPara, type Contexto } from '../nucleo/analise';
import { idKit, montarItem } from '../nucleo/itens';
import { opcoesKit } from '../nucleo/kits';
import { brl, kg } from '../util/formato';
import { navegar } from '../util/rota';
import { Botao, Modal, NotaBadge } from './ui';

export function MontarKit({ linha, ctx, fechar }: { linha: Linha; ctx: Contexto; fechar: () => void }) {
  const { anotar, avisar } = useDados();
  const p = linha.item.produto;
  const opcoes = useMemo(() => {
    const ladoMax = ctx.config.ocultarAcimaDoLado ? ctx.config.ladoMaxCm : 0;
    const com = linha.a.comissao;
    const prem = premissasPara(ctx.config, ctx.config.tipoAnuncioPadrao === 'premium' ? com.premium : com.classico);
    return opcoesKit(p, prem, ctx.tabela, ladoMax, ctx.config.pesoFreteModo).map((o) => ({ o, a: analisarItem(montarItem(p, o.q, ctx.config.pesoFreteModo), ctx) }));
  }, [p, ctx, linha.a.comissao]);

  async function escolher(q: number) {
    await anotar(p.sku, { kitMontado: true, kitQtd: q });
    avisar(`Kit de ${q} criado. Ele aparece em Kits recomendados.`);
    fechar();
    navegar('kits', { item: idKit(p.sku, q) });
  }

  return (
    <Modal titulo={`Montar kit: ${p.nome}`} aberto fechar={fechar} largura="max-w-3xl">
      <p className="mb-3 text-sm text-slate-600">
        Sozinho: venda Clássico {brl(linha.a.classico.preco)} (lucro {brl(linha.a.classico.conta.lucro)}). Escolha quantas unidades vão no kit.
      </p>
      {opcoes.length === 0 ? <p className="text-sm">Este produto é pesado demais para kit (passa de 30 kg).</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr><th className="py-1">Unidades</th><th>Custo</th><th>Peso</th><th>Maior lado</th><th>Venda Clássico</th><th>Venda Premium</th><th>Por unidade</th><th>Triagem</th><th /></tr>
          </thead>
          <tbody>
            {opcoes.map(({ o, a }) => (
              <tr key={o.q} className="border-t border-slate-100">
                <td className="py-1.5 font-medium">{o.q}</td>
                <td className="num">{brl(o.custo)}</td>
                <td className="num">{kg(a.item.peso)}</td>
                <td className={`num ${o.cabe ? '' : 'text-red-700'}`}>{Number.isFinite(o.ladoKit) ? `${Math.round(o.ladoKit)} cm` : '—'}{!o.cabe && ' (não cabe)'}</td>
                <td className="num">{brl(a.classico.preco)} <span className="text-xs text-slate-500">({brl(a.classico.conta.lucro)})</span></td>
                <td className="num">{brl(a.premium.preco)} <span className="text-xs text-slate-500">({brl(a.premium.conta.lucro)})</span></td>
                <td className="num">{brl(a.classico.preco / o.q)}</td>
                <td><NotaBadge nota={a.triagem} /></td>
                <td className="text-right"><Botao pequeno variante="primario" disabled={!o.cabe} onClick={() => escolher(o.q)}>Usar</Botao></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
