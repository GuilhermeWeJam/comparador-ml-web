// Janela de decisão: aprovar, reprovar (com motivo) ou adiar (com data). Motivo obrigatório quando contraria o veredito.
import { useState } from 'react';
import type { Linha } from '../dados/linhas';
import { useDados } from '../dados/store';
import { VEREDITOS } from '../nucleo/analise';
import type { TipoDecisao } from '../nucleo/tipos';
import { Botao, Campo, classeInput, Modal } from './ui';

export type AcaoDecisao = 'aprovado' | 'reprovado' | 'adiado';

const MOTIVOS_REPROVAR = ['Preço do mercado baixo', 'Pouca demanda', 'Concorrência forte', 'Risco ou regulação', 'Logística', 'Fora do foco da loja', 'Outro'];
const MOTIVOS_APROVAR = ['Conheço a demanda deste produto', 'Vou negociar o custo', 'Produto estratégico para a loja', 'Outro'];
const MOTIVOS_ADIAR = ['Época do ano', 'Esperar a pesquisa de kit', 'Esperar resposta do fornecedor', 'Outro'];

export function contraria(l: Linha, acao: AcaoDecisao): boolean {
  if (!l.d) return false;
  if (acao === 'aprovado') return l.d.veredito === 'descartar';
  if (acao === 'reprovado') return l.d.veredito === 'anunciar';
  return false;
}

export function Decidir({ linha, acao, fechar }: { linha: Linha; acao: AcaoDecisao; fechar: () => void }) {
  const { decidir, avisar } = useDados();
  const discorda = contraria(linha, acao);
  const motivos = acao === 'reprovado' ? MOTIVOS_REPROVAR : acao === 'adiado' ? MOTIVOS_ADIAR : MOTIVOS_APROVAR;
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [quando, setQuando] = useState(() => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const obrigatorio = acao === 'reprovado' || discorda;
  const titulo = acao === 'aprovado' ? `Aprovar ${linha.item.q > 1 ? 'kit' : 'unitário'}` : acao === 'reprovado' ? 'Reprovar' : 'Adiar';

  async function confirmar() {
    if (obrigatorio && !motivo) return;
    if (motivo === 'Outro' && !detalhe.trim()) return;
    setSalvando(true);
    try {
      await registrarDecisao(decidir, linha, acao, motivo, detalhe.trim(), acao === 'adiado' ? quando : null);
      avisar(`${linha.item.nome}: ${acao === 'aprovado' ? 'aprovado' : acao === 'reprovado' ? 'reprovado' : 'adiado'}.`);
      fechar();
    } catch (e) {
      avisar('Erro ao salvar: ' + (e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={titulo} aberto fechar={fechar} largura="max-w-lg" rodape={<>
      <Botao onClick={fechar}>Cancelar</Botao>
      <Botao variante={acao === 'reprovado' ? 'perigo' : 'primario'} onClick={confirmar} disabled={salvando || (obrigatorio && !motivo) || (motivo === 'Outro' && !detalhe.trim())}>Confirmar</Botao>
    </>}>
      <p className="mb-3 text-sm text-slate-700"><b>{linha.item.nome}</b></p>
      {discorda && linha.d && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          O veredito sugerido é <b>{VEREDITOS[linha.d.veredito].rotulo}</b>. Para decidir diferente, diga o motivo: isso ajuda a ajustar os pesos das notas.
        </p>
      )}
      <div className="grid gap-3">
        <Campo rotulo={`Motivo${obrigatorio ? ' *' : ' (opcional)'}`}>
          <select className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} data-campo="motivo">
            <option value="">—</option>
            {motivos.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo rotulo={`Detalhe${motivo === 'Outro' ? ' *' : ''}`}>
          <input className={classeInput} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="opcional" />
        </Campo>
        {acao === 'adiado' && (
          <Campo rotulo="Rever em">
            <input type="date" className={classeInput} value={quando} onChange={(e) => setQuando(e.target.value)} />
          </Campo>
        )}
      </div>
    </Modal>
  );
}

/** Grava a decisão com a foto do momento (custo, notas e veredito). */
export async function registrarDecisao(
  decidir: ReturnType<typeof useDados>['decidir'], l: Linha, decisao: TipoDecisao, motivo = '', detalhe = '', revisarEm: string | null = null,
) {
  await decidir({
    itemId: l.id,
    decisao,
    motivo,
    motivoDetalhe: detalhe,
    revisarEm,
    custoMomento: l.item.custo,
    notaTriagemMomento: l.a.triagem.total,
    notaDecisaoMomento: l.d ? l.d.nota.total : null,
    vereditoMomento: l.d ? l.d.veredito : null,
  });
}
