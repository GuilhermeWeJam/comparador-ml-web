import { Layout } from './componentes/Layout';
import { configurado } from './dados/supabase';
import { useDados } from './dados/store';
import { Configuracoes } from './paginas/Configuracoes';
import { Entrar, NaoConfigurado, SemAcesso } from './paginas/Entrar';
import { Importar } from './paginas/Importar';
import { Inicio } from './paginas/Inicio';
import { Produtos } from './paginas/Produtos';
import { useRota } from './util/rota';

export function App() {
  const { email, admin, carregando, erro, produtos, recarregar } = useDados();
  const rota = useRota();

  if (!configurado) return <NaoConfigurado />;
  if (email === undefined) return <Carregando texto="Abrindo…" />;
  if (!email) return <Entrar />;
  if (admin === false) return <SemAcesso />;
  if (admin === null || (carregando && produtos.size === 0)) return <Carregando texto="Carregando os produtos…" />;

  let pagina;
  // sem produtos, a entrada do sistema é a importação da planilha
  const semProdutos = produtos.size === 0;
  switch (rota.pagina) {
    case 'importar': pagina = <Importar />; break;
    case 'produtos': pagina = semProdutos ? <Importar /> : <Produtos aba="produtos" />; break;
    case 'aprovados': pagina = semProdutos ? <Importar /> : <Produtos aba="aprovados" />; break;
    case 'kits': pagina = semProdutos ? <Importar /> : <Produtos aba="kits" />; break;
    case 'config': pagina = <Configuracoes />; break;
    default: pagina = semProdutos ? <Importar /> : <Inicio />;
  }
  return (
    <Layout>
      {erro && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Não consegui falar com o banco: {erro}</span>
          <button type="button" className="font-medium underline" onClick={() => recarregar()}>Tentar de novo</button>
        </div>
      )}
      {pagina}
    </Layout>
  );
}

function Carregando({ texto }: { texto: string }) {
  return <div className="grid min-h-screen place-items-center text-slate-500">{texto}</div>;
}
