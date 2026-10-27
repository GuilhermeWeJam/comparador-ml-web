import type { ReactNode } from 'react';
import { useDados } from '../dados/store';
import { montarHash, useRota } from '../util/rota';

const MENU = [
  { pagina: '', rotulo: 'Início' },
  { pagina: 'produtos', rotulo: 'Produtos' },
  { pagina: 'kits', rotulo: 'Kits recomendados' },
  { pagina: 'aprovados', rotulo: 'Aprovados' },
  { pagina: 'importar', rotulo: 'Importar' },
  { pagina: 'config', rotulo: 'Configurações' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { email, sair, aviso, avisar } = useDados();
  const { pagina } = useRota();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <a href="#/" className="flex items-center gap-2 font-semibold text-slate-900">
            <img src="./icone.svg" alt="" className="h-7 w-7" />
            Comparador ML
          </a>
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto whitespace-nowrap text-sm sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
            {MENU.map((m) => (
              <a
                key={m.pagina}
                href={montarHash(m.pagina)}
                className={`rounded-lg px-3 py-1.5 ${pagina === m.pagina ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {m.rotulo}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600 sm:ml-0">
            <span className="hidden sm:inline">{email}</span>
            <button type="button" onClick={() => sair()} className="rounded-lg px-2 py-1 hover:bg-slate-100">Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-5">{children}</main>
      {aviso && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {aviso}
          <button type="button" className="ml-3 text-slate-300 hover:text-white" onClick={() => avisar(null)} aria-label="Fechar aviso">✕</button>
        </div>
      )}
    </div>
  );
}
