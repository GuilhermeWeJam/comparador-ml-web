import { frete, FRETE_PADRAO } from './frete';
import type { Dims, ModoPesoFrete, Premissas, TabelaFrete } from './tipos';

export const LADO_PADRAO = 70;
const LADO_SUSPEITO = 300; // cm: acima disso é erro de cadastro

export interface Conta {
  preco: number;
  custo: number;
  comissao: number;
  envio: number;
  imposto: number;
  reserva: number;
  lucro: number;
  margem: number;
  margemAds: number;
  veredito: 'viavel' | 'apertado' | 'prejuizo';
}

/** Conta completa de uma venda ao preço informado. */
export function contaVenda(preco: number, custo: number, peso: number, p: Premissas, tabela: TabelaFrete = FRETE_PADRAO): Conta {
  const comissao = preco * p.comissao;
  const envio = frete(preco, peso, tabela);
  const imposto = preco * p.imposto;
  const reserva = preco * p.reserva;
  const lucro = preco - custo - comissao - envio - imposto - reserva;
  const margem = preco > 0 ? lucro / preco : 0;
  const margemAds = margem - p.ads;
  const veredito = margem >= p.margemMinima - 1e-9 ? 'viavel' : lucro >= 0 ? 'apertado' : 'prejuizo';
  return { preco, custo, comissao, envio, imposto, reserva, lucro, margem, margemAds, veredito };
}

const arredondaCima = (x: number) => Math.ceil(x - 1e-9);

/** Menor preço terminado em ,90 que entrega a margem pedida (mesma conta da planilha e do plugin). */
export function precoParaMargem(custo: number, peso: number, margem: number, p: Premissas, tabela: TabelaFrete = FRETE_PADRAO): number {
  const k = 1 - p.comissao - p.imposto - p.reserva - margem;
  if (!(custo > 0) || k <= 0.01) return NaN;
  let preco = custo / k;
  for (let i = 0; i < 8; i++) preco = (custo + frete(preco, peso, tabela)) / k;
  let r = Math.max(arredondaCima(preco - 0.9) + 0.9, 10.9);
  for (let i = 0; i < 2; i++) {
    const f = frete(r, peso, tabela);
    if (r * k - f < custo - 1e-6) r = arredondaCima((custo + f) / k - 0.9) + 0.9;
  }
  return Math.round(r * 100) / 100;
}

/** Teto de custo: quanto o produto pode custar para, vendido a `preco`, sobrar `margem`. Margem 0 = empate. */
export function custoMaximo(preco: number, peso: number, margem: number, p: Premissas, tabela: TabelaFrete = FRETE_PADRAO): number {
  if (!(preco > 0)) return NaN;
  return preco * (1 - p.comissao - p.imposto - p.reserva - (margem || 0)) - frete(preco, peso, tabela);
}

/** Desconto que você precisa do fornecedor para chegar ao teto (0 = já está dentro; 1 = impossível). */
export function descontoNecessario(custoAtual: number, teto: number): number {
  if (!(custoAtual > 0) || !Number.isFinite(teto)) return NaN;
  if (teto >= custoAtual) return 0;
  return teto <= 0 ? 1 : 1 - teto / custoAtual;
}

/**
 * Peso usado no frete. Modo 'real' (padrão): só o peso informado (da caixa, se houver, senão do produto).
 * Modo 'cubico': o maior entre o real e o cúbico (L × A × C ÷ 6.000). 0,5 kg se não houver nada.
 */
export function pesoFrete(pesoKg: number | null, pesoCaixaKg: number | null, dims: Dims | null = null, modo: ModoPesoFrete = 'real'): number {
  const real = pesoCaixaKg && pesoCaixaKg > 0 ? pesoCaixaKg : pesoKg && pesoKg > 0 ? pesoKg : 0;
  let cubico = 0;
  if (modo === 'cubico' && dims) {
    // medidas acima de 200 cm são quase sempre erro de cadastro; não deixam o peso cúbico explodir
    const d = dims.map((x) => Math.min(x || 0, 200));
    cubico = (d[0] * d[1] * d[2]) / 6000;
  }
  const peso = Math.max(real, cubico || 0);
  return Math.round((peso > 0 ? peso : 0.5) * 1000) / 1000;
}

export type StatusTamanho = 'ok' | 'fora' | 'suspeita' | 'sem';

/** Situação de tamanho: 'ok', 'fora' (passa do limite), 'suspeita' (medida > 300 cm) ou 'sem' medida. */
export function tamanho(dims: Dims | null, ladoMax: number): { status: StatusTamanho; maior: number } {
  if (!dims || !dims.some((x) => x > 0)) return { status: 'sem', maior: NaN };
  const maior = Math.max(...dims);
  if (maior > LADO_SUSPEITO) return { status: 'suspeita', maior };
  if (ladoMax > 0 && maior > ladoMax) return { status: 'fora', maior };
  return { status: 'ok', maior };
}

/** Maior lado estimado de uma caixa com q unidades, no melhor empilhamento (q = x·y·z). */
export function maiorLadoKit(dims: Dims | null, q: number): number {
  if (!dims || !dims.length) return NaN;
  const [a, b, c] = [...dims].sort((x, y) => y - x);
  let melhor = Infinity;
  for (let x = 1; x <= q; x++)
    for (let y = 1; y <= q; y++)
      for (let z = 1; z <= q; z++) {
        if (x * y * z !== q) continue;
        melhor = Math.min(melhor, Math.max(a * x, b * y, c * z));
      }
  return melhor;
}
