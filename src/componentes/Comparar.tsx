import type { ReactNode } from 'react';
import type { Linha } from '../dados/linhas';
import { brl, kg, pct } from '../util/formato';
import { Modal, NotaBadge, VereditoBadge } from './ui';

export function Comparar({ linhas, fechar }: { linhas: Linha[]; fechar: () => void }) {
  const linhasTabela: [string, (l: Linha) => ReactNode][] = [
    ['Custo', (l) => brl(l.item.custo)],
    ['Categoria ML', (l) => `${l.a.comissao.categoriaMl} (${pct(l.a.comissao.classico)} / ${pct(l.a.comissao.premium)})`],
    ['Peso para frete', (l) => kg(l.item.peso)],
    ['Venda Clássico', (l) => <>{brl(l.a.classico.preco)} <span className="text-slate-500">lucro {brl(l.a.classico.conta.lucro)}</span></>],
    ['Venda Premium', (l) => <>{brl(l.a.premium.preco)} <span className="text-slate-500">lucro {brl(l.a.premium.conta.lucro)}</span></>],
    ['Frete no Clássico', (l) => brl(l.a.classico.conta.envio)],
    ['Preço mínimo', (l) => `${brl(l.a.classico.minimo)} / ${brl(l.a.premium.minimo)}`],
    ['Nota de triagem', (l) => <NotaBadge nota={l.a.triagem} />],
    ['Preço de referência', (l) => brl(l.d?.precoRef)],
    ['Margem na referência', (l) => pct(l.d?.conta?.margem)],
    ['Vendidos (mais vendido)', (l) => l.pesq?.vendidosMaisVendido?.toLocaleString('pt-BR') ?? '—'],
    ['Concorrentes', (l) => l.pesq?.concorrentes?.replace('10+', 'mais de 10') ?? '—'],
    ['Nota de decisão', (l) => <NotaBadge nota={l.d?.nota} />],
    ['Veredito', (l) => <VereditoBadge veredito={l.d?.veredito} motivo={l.d?.motivo} />],
    ['Alertas', (l) => l.a.alertas.map((a) => a.tipo).join(', ') || '—'],
  ];
  return (
    <Modal titulo={`Comparar ${linhas.length} produtos`} aberto fechar={fechar} largura="max-w-6xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="w-44" />
              {linhas.map((l) => (
                <th key={l.id} className="px-3 py-2 text-left align-top font-medium">
                  {l.item.produto.imagemUrl && <img src={l.item.produto.imagemUrl} alt="" className="mb-1 h-16 w-16 rounded border border-slate-200 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                  {l.item.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasTabela.map(([rot, f]) => (
              <tr key={rot} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">{rot}</td>
                {linhas.map((l) => <td key={l.id} className="num px-3 py-1.5">{f(l)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
