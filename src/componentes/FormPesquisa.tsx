// Formulário da pesquisa do concorrente (digitada no site nesta etapa; o plugin preencherá os mesmos campos).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { Concorrentes, Pesquisa } from '../nucleo/tipos';
import { lerNumero } from '../util/formato';
import { classeInput } from './ui';

export interface FormPesquisaRef {
  salvar: () => void;
  naoEncontrei: () => void;
  focar: () => void;
}

interface Props {
  itemId: string;
  q: number;
  anterior?: Pesquisa;
  inicio: number; // Date.now() de quando a pesquisa começou (mede o tempo gasto)
  aoSalvar: (p: Pesquisa) => Promise<void> | void;
  salvando?: boolean;
}

const vazio = { menor: '', maisVendido: '', vendidos: '', concorrentes: '' as '' | Concorrentes, full: false, oficial: false, qtd: '', link: '', obs: '' };

export const FormPesquisa = forwardRef<FormPesquisaRef, Props>(function FormPesquisa({ itemId, q, anterior, inicio, aoSalvar, salvando }, ref) {
  const [v, setV] = useState(vazio);
  const [erro, setErro] = useState<string | null>(null);
  const primeiro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setV(vazio);
    setErro(null);
    setTimeout(() => primeiro.current?.focus(), 30);
  }, [itemId]);

  function montar(naoEncontrado: boolean): Pesquisa | null {
    const menor = lerNumero(v.menor);
    if (!naoEncontrado && !(menor > 0)) { setErro('Digite o menor preço (ou marque "Não encontrei").'); return null; }
    const maisVendido = lerNumero(v.maisVendido);
    const vendidos = lerNumero(v.vendidos);
    const qtd = parseInt(v.qtd, 10);
    return {
      itemId,
      naoEncontrado,
      menorPreco: naoEncontrado ? null : menor,
      precoMaisVendido: !naoEncontrado && maisVendido > 0 ? maisVendido : null,
      vendidosMaisVendido: !naoEncontrado && vendidos >= 0 ? Math.round(vendidos) : null,
      concorrentes: naoEncontrado ? null : v.concorrentes || null,
      temFull: naoEncontrado ? null : v.full,
      temOficial: naoEncontrado ? null : v.oficial,
      qtdNoAnuncio: !naoEncontrado && qtd > 0 ? qtd : null,
      link: v.link.trim(),
      observacao: v.obs.trim(),
      origem: 'manual',
      segundosGastos: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
    };
  }

  async function enviar(naoEncontrado: boolean) {
    const p = montar(naoEncontrado);
    if (!p) return;
    setErro(null);
    try { await aoSalvar(p); } catch (e) { setErro(String((e as Error).message || e)); }
  }

  useImperativeHandle(ref, () => ({ salvar: () => enviar(false), naoEncontrei: () => enviar(true), focar: () => primeiro.current?.focus() }));

  const set = (k: keyof typeof vazio) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  const teclas = (e: KeyboardEvent) => {
    const alvo = e.target as HTMLInputElement;
    if (e.key === 'Enter' && !(alvo instanceof HTMLTextAreaElement)) { e.preventDefault(); e.stopPropagation(); enviar(false); }
    // "n" no campo de menor preço vazio = não encontrei
    else if ((e.key === 'n' || e.key === 'N') && alvo.dataset?.campo === 'menor' && !alvo.value) { e.preventDefault(); e.stopPropagation(); enviar(true); }
  };

  return (
    <form className="grid gap-2.5 text-sm" onSubmit={(e) => { e.preventDefault(); enviar(false); }} onKeyDown={teclas}>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid gap-1"><span className="font-medium">Menor preço (R$) *</span>
          <input ref={primeiro} inputMode="decimal" className={classeInput} value={v.menor} onChange={set('menor')} placeholder={anterior?.menorPreco ? String(anterior.menorPreco).replace('.', ',') : 'ex.: 49,90'} data-campo="menor" /></label>
        <label className="grid gap-1"><span className="font-medium">Preço do que mais vende</span>
          <input inputMode="decimal" className={classeInput} value={v.maisVendido} onChange={set('maisVendido')} placeholder="recomendado" data-campo="maisVendido" /></label>
        <label className="grid gap-1"><span className="font-medium">Vendidos do que mais vende</span>
          <input inputMode="numeric" className={classeInput} value={v.vendidos} onChange={set('vendidos')} placeholder="ex.: 500" data-campo="vendidos" /></label>
        <label className="grid gap-1"><span className="font-medium">Anúncios do mesmo produto</span>
          <select className={classeInput} value={v.concorrentes} onChange={set('concorrentes')} data-campo="concorrentes">
            <option value="">—</option><option value="1-3">1 a 3</option><option value="4-10">4 a 10</option><option value="10+">mais de 10</option>
          </select></label>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={v.full} onChange={set('full')} /> Tem Full</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={v.oficial} onChange={set('oficial')} /> Tem loja oficial</label>
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-2.5">
        <label className="grid gap-1"><span className="font-medium">Qtd. no anúncio</span>
          <input inputMode="numeric" className={classeInput} value={v.qtd} onChange={set('qtd')} placeholder={q > 1 ? String(q) : '1'} title="Se o anúncio de referência vende outra quantidade (ex.: Kit 6), o preço é convertido" /></label>
        <label className="grid gap-1"><span className="font-medium">Link do anúncio de referência</span>
          <input className={classeInput} value={v.link} onChange={set('link')} placeholder="opcional" /></label>
      </div>
      <label className="grid gap-1"><span className="font-medium">Observação</span>
        <input className={classeInput} value={v.obs} onChange={set('obs')} placeholder="opcional" /></label>
      {erro && <p className="text-red-700">{erro}</p>}
      <p className="text-xs text-slate-500">Compare só anúncios do <b>mesmo produto</b> (mesma medida, quantidade e material). Enter salva; “n” no campo de menor preço vazio marca não encontrei.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={salvando} className="rounded-lg bg-blue-600 px-3.5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">Salvar pesquisa</button>
        <button type="button" disabled={salvando} onClick={() => enviar(true)} className="rounded-lg border border-slate-300 px-3.5 py-2 hover:bg-slate-50 disabled:opacity-50">Não encontrei</button>
      </div>
    </form>
  );
});
