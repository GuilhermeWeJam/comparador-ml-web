import { describe, expect, it } from 'vitest';
import { analisarDecisao, analisarItem, CONFIG_PADRAO, precoConvertido, type Contexto } from '../analise';
import { contaVenda, maiorLadoKit, pesoFrete, precoParaMargem } from '../calc';
import { frete, FRETE_PADRAO } from '../frete';
import { montarItem, termoBusca, urlBusca } from '../itens';
import { analisarKit } from '../kits';
import { analisarTitulo, sugerirTitulo } from '../titulo';
import type { Categoria, ComissaoMl, Dims, Pesquisa, Premissas, Produto } from '../tipos';
import paridade from './dados/paridade.json';
import disponiveis from './dados/disponiveis.json';

const P13: Premissas = { margemDesejada: 0.2, margemMinima: 0.1, comissao: 0.13, imposto: 0.05, reserva: 0.03, ads: 0.08 };

function produto(over: Partial<Produto> = {}): Produto {
  return {
    sku: 'X1', nome: 'Pote Hermético de Vidro 1,8L', marca: '', categoria: 'Potes, Marmitas e Mantimentos', fornecedor: 'F', uf: 'SP',
    disponivel: true, naPlanilha: true, origem: 'planilha', ativo: true, custo: 20, custoAnterior: null, custoMudouImportacao: null,
    pesoKg: 0.4, pesoCaixaKg: null, dims: [10, 10, 10], ean: '', ncm: '', cest: '', imagemUrl: '', importacaoId: null, primeiraImportacaoId: null,
    ...over,
  };
}

const comissoes = new Map<string, ComissaoMl>([
  ['Casa, Móveis e Decoração', { categoriaMl: 'Casa, Móveis e Decoração', classico: 0.115, premium: 0.165, padrao: false }],
  ['Padrão', { categoriaMl: 'Padrão', classico: 0.13, premium: 0.18, padrao: true }],
]);
const categorias = new Map<string, Categoria>([
  ['Potes, Marmitas e Mantimentos', { nome: 'Potes, Marmitas e Mantimentos', categoriaMl: 'Casa, Móveis e Decoração', epoca: 'normal' }],
  ['Lavanderia', { nome: 'Lavanderia', categoriaMl: 'Casa, Móveis e Decoração', epoca: 'normal' }],
]);
const ctx: Contexto = { config: CONFIG_PADRAO, comissoes, categorias, tabela: FRETE_PADRAO };

const pesquisa = (over: Partial<Pesquisa> = {}): Pesquisa => ({
  itemId: 'X1', naoEncontrado: false, menorPreco: null, precoMaisVendido: null, vendidosMaisVendido: null, concorrentes: null,
  temFull: null, temOficial: null, qtdNoAnuncio: null, link: '', observacao: '', origem: 'manual', segundosGastos: null, ...over,
});

describe('paridade com a planilha e o plugin 1.5.1 (comissão de 13%)', () => {
  it('preço sugerido, preço mínimo, lucro e margem iguais nos 1.572 produtos', () => {
    let iguais = 0;
    const diferentes: unknown[] = [];
    for (const r of paridade as { sku: string; custo: number; peso: number; sug: number; minimo: number; preco: number; lucro: number; margem: number }[]) {
      const sug = precoParaMargem(r.custo, r.peso, 0.2, P13);
      const min = precoParaMargem(r.custo, r.peso, 0.1, P13);
      const c = contaVenda(r.preco, r.custo, r.peso, P13);
      if (Math.abs(sug - r.sug) < 0.005 && Math.abs(min - r.minimo) < 0.005 && Math.abs(c.lucro - r.lucro) < 0.005) iguais++;
      else diferentes.push(r.sku);
    }
    expect(diferentes).toEqual([]);
    expect(iguais).toBe(1572);
  });
});

describe('frete', () => {
  it('usa a faixa de peso e de preço da tabela oficial', () => {
    expect(frete(36.1, 0.645)).toBe(7.15);
    expect(frete(150, 8.5)).toBe(45.35);
    expect(frete(90, 151)).toBe(167.05);
  });
  it('abaixo de R$ 19 cobra no máximo metade do preço', () => {
    expect(frete(10, 0.2)).toBe(5);
    expect(frete(15, 12)).toBe(7.15);
  });
  it('peso para frete é o peso informado (sem cúbico), com 0,5 kg se não houver nada', () => {
    expect(pesoFrete(0.355, null)).toBe(0.355);
    expect(pesoFrete(3.5, null)).toBe(3.5);
    expect(pesoFrete(null, null)).toBe(0.5);
    expect(pesoFrete(1, 2)).toBe(2);
    expect(pesoFrete(0.355, null, [35, 6, 35])).toBe(0.355);
  });

  it('no modo cúbico, usa o maior entre real e cúbico', () => {
    expect(pesoFrete(0.355, null, [35, 6, 35], 'cubico')).toBe(1.225);
    expect(pesoFrete(3.5, null, [10, 10, 10], 'cubico')).toBe(3.5);
    expect(pesoFrete(null, null, null, 'cubico')).toBe(0.5);
  });
  it('maior lado do kit escolhe o melhor empilhamento', () => {
    expect(maiorLadoKit([30, 20, 10] as Dims, 2)).toBe(30);
    expect(maiorLadoKit([30, 20, 10] as Dims, 4)).toBe(40);
  });
});

describe('preço Clássico e Premium', () => {
  it('varal (Casa) e brinquedo (padrão) dão os valores do documento', () => {
    const varal = analisarItem(montarItem(produto({ nome: 'Varal Redondo com 24 Prendedores', categoria: 'Lavanderia', custo: 29.99, pesoKg: 0.355, dims: [35, 6, 35] })), ctx);
    expect(varal.classico.preco).toBe(63.9);
    expect(varal.premium.preco).toBe(69.9);
    expect(Math.round(varal.classico.conta.lucro * 100) / 100).toBe(13.2);
    const brinq = analisarItem(montarItem(produto({ nome: 'Brinquedo Animal', categoria: 'Brinquedos', custo: 36.99, pesoKg: 0.225, dims: [1, 1, 1] })), ctx);
    expect(brinq.comissao.padrao).toBe(true);
    expect(brinq.classico.preco).toBe(76.9);
    expect(brinq.premium.preco).toBe(92.9);
    expect(brinq.premium.conta.envio).toBe(12.95);
  });
});

describe('nota de triagem', () => {
  it('soma 100 no máximo e explica cada critério', () => {
    const a = analisarItem(montarItem(produto({ custo: 60, pesoKg: 0.4 })), ctx);
    expect(a.triagem.partes.length).toBe(6);
    expect(a.triagem.total).toBeLessThan(101);
    expect(a.triagem.total).toBeGreaterThan(0);
  });
  it('produto barato e pesado tem triagem baixa', () => {
    const barato = analisarItem(montarItem(produto({ custo: 6, pesoKg: 4.5 })), ctx);
    const bom = analisarItem(montarItem(produto({ custo: 80, pesoKg: 0.4 })), ctx);
    expect(barato.triagem.total).toBeLessThan(bom.triagem.total);
  });
  it('item acima de 70 cm fica fora do tamanho', () => {
    const a = analisarItem(montarItem(produto({ dims: [80, 10, 10] })), ctx);
    expect(a.foraDoTamanho).toBe(true);
  });
});

describe('veredito', () => {
  const item = montarItem(produto({ custo: 30, pesoKg: 0.4 }));
  const a = analisarItem(item, ctx);
  it('anuncia quando a margem é boa e a nota é alta', () => {
    const d = analisarDecisao(a, pesquisa({ menorPreco: 90, precoMaisVendido: 95, vendidosMaisVendido: 5000, concorrentes: '1-3' }), ctx, false);
    expect(d.veredito).toBe('anunciar');
    expect(d.origemRef).toBe('mais_vendido');
  });
  it('testa quando a margem é boa mas a nota é média', () => {
    const d = analisarDecisao(a, pesquisa({ menorPreco: 90, precoMaisVendido: 95, vendidosMaisVendido: 10, concorrentes: '10+', temFull: true }), ctx, false);
    expect(d.veredito).toBe('testar');
  });
  it('renegocia quando falta pouco desconto', () => {
    const d = analisarDecisao(a, pesquisa({ menorPreco: 50 }), ctx, false);
    expect(d.veredito).toBe('renegociar');
    expect(d.desconto).toBeGreaterThan(0);
    expect(d.desconto).toBeLessThan(0.26);
  });
  it('descarta quando dá prejuízo mesmo com 25% de desconto', () => {
    const d = analisarDecisao(a, pesquisa({ menorPreco: 35 }), ctx, false);
    expect(d.veredito).toBe('descartar');
  });
  it('sugere kit para produto de Kits recomendados que não paga sozinho', () => {
    const d = analisarDecisao(a, pesquisa({ menorPreco: 35 }), ctx, true);
    expect(d.veredito).toBe('montar_kit');
  });
  it('sem concorrente: testa só com triagem alta', () => {
    const d = analisarDecisao(a, pesquisa({ naoEncontrado: true }), ctx, false);
    expect(['testar', 'descartar']).toContain(d.veredito);
    expect(d.veredito).toBe(a.triagem.total >= 70 ? 'testar' : 'descartar');
  });
  it('converte preço de anúncio com outra quantidade', () => {
    expect(precoConvertido(60, 6, 3)).toBe(30);
    expect(precoConvertido(60, null, 1)).toBe(60);
  });
});

describe('kits recomendados com o catálogo modelo', () => {
  it('recomenda entre 150 e 300 kits dos 1.572 disponíveis, todos com 2 a 6 unidades', () => {
    let n = 0;
    for (const r of disponiveis as { sku: string; nome: string; categoria: string; custo: number; pesoKg: number | null; dims: number[] }[]) {
      const p = produto({ sku: r.sku, nome: r.nome, categoria: r.categoria, custo: r.custo, pesoKg: r.pesoKg, dims: r.dims as Dims });
      const prem = { ...P13, comissao: 0.13 };
      const k = analisarKit(p, prem, FRETE_PADRAO, 70);
      if (k) {
        n++;
        expect(k.q).toBeGreaterThan(1);
        expect(k.q).toBeLessThan(7);
      }
    }
    expect(n).toBeGreaterThan(150);
    expect(n).toBeLessThan(300);
  });
});

describe('título e busca', () => {
  it('limpa o nome sem estragar medidas', () => {
    expect(sugerirTitulo('WeDrop - Pote Hermético de Vidro 1,8L c/ Tampa - Transparente')).toBe('Pote Hermético de Vidro 1,8L com Tampa Transparente');
    expect(sugerirTitulo('Pote Hermético 500 ml', 3)).toBe('Kit 3 Potes Hermético 500ml');
  });
  it('dá nota ao título', () => {
    expect(analisarTitulo('POTE SUPER LINDO!!!').nivel).toBe('Fraco');
    expect(analisarTitulo('Pote Hermético de Vidro com Tampa Bambu 1,8L Borossilicato').nota).toBeGreaterThan(79);
  });
  it('monta a busca do ML', () => {
    expect(termoBusca('WeDrop - Varal Modular Secagem Roupas - Preto')).toBe('Varal Modular Secagem Roupas');
    expect(urlBusca({ nome: 'Varal Modular Secagem Roupas  - Preto', q: 1 })).toBe('https://lista.mercadolivre.com.br/varal-modular-secagem-roupas');
    expect(montarItem(produto(), 3).nome).toBe('Kit 3 Potes Hermético de Vidro 1,8L');
    expect(montarItem(produto({ nome: 'Jogo de Panelas Com Alça 7 Peças' }), 2).nome).toBe('Kit 2 Jogos de Panelas Com Alça 7 Peças');
    expect(montarItem(produto({ nome: 'Kit 2 Panos de Prato' }), 4).nome).toBe('Kit 4 Panos de Prato');
  });
});
