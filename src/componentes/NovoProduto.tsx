// Cadastro manual de produto (e edição de um produto manual), com o cálculo ao vivo.
import { useMemo, useState } from 'react';
import { useDados } from '../dados/store';
import { erroDe } from '../dados/supabase';
import { analisarItem, type Contexto } from '../nucleo/analise';
import { montarItem } from '../nucleo/itens';
import type { Dims, Produto } from '../nucleo/tipos';
import { brl, kg, lerNumero } from '../util/formato';
import { Botao, Campo, classeInput, Modal, NotaBadge } from './ui';

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

export function NovoProduto({ ctx, editar, fechar }: { ctx: Contexto; editar?: Produto; fechar: () => void }) {
  const { salvarProduto, produtos, categorias, avisar } = useDados();
  const [v, setV] = useState(() => ({
    sku: editar?.sku || '', nome: editar?.nome || '', marca: editar?.marca || '', categoria: editar?.categoria || '',
    fornecedor: editar?.fornecedor || '', uf: editar?.uf || 'SP', custo: editar ? String(editar.custo).replace('.', ',') : '',
    peso: editar?.pesoKg ? String(editar.pesoKg).replace('.', ',') : '', largura: editar?.dims ? String(editar.dims[0]) : '',
    altura: editar?.dims ? String(editar.dims[1]) : '', comprimento: editar?.dims ? String(editar.dims[2]) : '',
    ean: editar?.ean || '', ncm: editar?.ncm || '', imagem: editar?.imagemUrl || '',
  }));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  const custo = lerNumero(v.custo);
  const peso = lerNumero(v.peso);
  const dims = [lerNumero(v.largura), lerNumero(v.altura), lerNumero(v.comprimento)];
  const completo = v.nome.trim() && custo > 0 && peso > 0 && dims.every((d) => d > 0);

  const proximoSku = useMemo(() => {
    let max = 0;
    for (const s of produtos.keys()) { const m = s.match(/^MAN-(\d+)$/); if (m) max = Math.max(max, Number(m[1])); }
    return `MAN-${String(max + 1).padStart(4, '0')}`;
  }, [produtos]);

  const produto: Produto | null = completo ? {
    sku: editar?.sku || v.sku.trim() || proximoSku, nome: v.nome.trim(), marca: v.marca.trim(), categoria: v.categoria.trim(),
    fornecedor: v.fornecedor.trim(), uf: v.uf, disponivel: true, naPlanilha: false, origem: 'manual', ativo: true, custo,
    custoAnterior: null, custoMudouImportacao: null, pesoKg: peso, pesoCaixaKg: null, dims: dims as Dims, ean: v.ean.trim(),
    ncm: v.ncm.trim(), cest: '', imagemUrl: v.imagem.trim(), importacaoId: null, primeiraImportacaoId: null,
  } : null;
  const previa = useMemo(() => (produto ? analisarItem(montarItem(produto, 1), ctx) : null), [produto, ctx]);

  async function salvar() {
    if (!produto) return;
    if (!editar && produtos.has(produto.sku)) { setErro(`Já existe um produto com o SKU ${produto.sku}.`); return; }
    setSalvando(true);
    setErro(null);
    try {
      await salvarProduto(produto, !editar);
      avisar(editar ? 'Produto atualizado.' : `Produto ${produto.sku} criado.`);
      fechar();
    } catch (e) {
      const m = erroDe(e);
      setErro(/duplicate|unique|chave/i.test(m) ? `O SKU ${produto.sku} já existe (talvez num produto indisponível da planilha). Use outro.` : m);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={editar ? `Editar ${editar.sku}` : 'Novo produto'} aberto fechar={fechar} largura="max-w-3xl" rodape={<>
      <Botao onClick={fechar}>Cancelar</Botao>
      <Botao variante="primario" onClick={salvar} disabled={!completo || salvando}>{editar ? 'Salvar' : 'Criar produto'}</Botao>
    </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome *" className="sm:col-span-2"><input className={classeInput} value={v.nome} onChange={set('nome')} data-campo="nome" /></Campo>
        <Campo rotulo="SKU" dica={editar ? 'não pode ser alterado' : `vazio = ${proximoSku}`}><input className={classeInput} value={editar ? editar.sku : v.sku} onChange={set('sku')} disabled={!!editar} /></Campo>
        <Campo rotulo="Marca"><input className={classeInput} value={v.marca} onChange={set('marca')} /></Campo>
        <Campo rotulo="Categoria" dica="define a comissão">
          <input className={classeInput} list="lista-categorias" value={v.categoria} onChange={set('categoria')} />
          <datalist id="lista-categorias">{[...categorias.keys()].map((c) => <option key={c} value={c} />)}</datalist>
        </Campo>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Campo rotulo="Fornecedor"><input className={classeInput} value={v.fornecedor} onChange={set('fornecedor')} /></Campo>
          <Campo rotulo="UF"><select className={classeInput} value={v.uf} onChange={set('uf')}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Campo>
        </div>
        <Campo rotulo="Custo (R$) *"><input inputMode="decimal" className={classeInput} value={v.custo} onChange={set('custo')} data-campo="custo" /></Campo>
        <Campo rotulo="Peso (kg) *"><input inputMode="decimal" className={classeInput} value={v.peso} onChange={set('peso')} data-campo="peso" /></Campo>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Campo rotulo="Largura (cm) *"><input inputMode="decimal" className={classeInput} value={v.largura} onChange={set('largura')} data-campo="largura" /></Campo>
          <Campo rotulo="Altura (cm) *"><input inputMode="decimal" className={classeInput} value={v.altura} onChange={set('altura')} data-campo="altura" /></Campo>
          <Campo rotulo="Comprimento (cm) *"><input inputMode="decimal" className={classeInput} value={v.comprimento} onChange={set('comprimento')} data-campo="comprimento" /></Campo>
        </div>
        <Campo rotulo="EAN"><input className={classeInput} value={v.ean} onChange={set('ean')} /></Campo>
        <Campo rotulo="NCM"><input className={classeInput} value={v.ncm} onChange={set('ncm')} /></Campo>
        <Campo rotulo="Link da foto" className="sm:col-span-2"><input className={classeInput} value={v.imagem} onChange={set('imagem')} /></Campo>
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm" data-testid="previa">
        {previa ? (
          <div className="grid gap-1">
            <div>Venda <b>{brl(previa.classico.preco)}</b> Clássico (lucro {brl(previa.classico.conta.lucro)}) · <b>{brl(previa.premium.preco)}</b> Premium (lucro {brl(previa.premium.conta.lucro)})</div>
            <div>Frete no Clássico {brl(previa.classico.conta.envio)} · peso para frete {kg(previa.item.peso)} · comissão {previa.comissao.categoriaMl}</div>
            <div className="flex items-center gap-2">Nota de triagem <NotaBadge nota={previa.triagem} />{previa.foraDoTamanho && <span className="text-red-700">passa do limite de tamanho</span>}</div>
          </div>
        ) : <span className="text-slate-500">Preencha nome, custo, peso e medidas para ver o cálculo.</span>}
      </div>
      {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
    </Modal>
  );
}
