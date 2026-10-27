// Rotas pelo "#/" do endereço: funciona no GitHub Pages, que só entrega arquivos.
import { useCallback, useEffect, useState } from 'react';

export interface Rota {
  pagina: string; // "", "importar", "produtos", "kits", "aprovados", "config"
  params: URLSearchParams;
}

function lerRota(): Rota {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [caminho, busca] = h.split('?');
  return { pagina: caminho.replace(/\/$/, ''), params: new URLSearchParams(busca || '') };
}

export function montarHash(pagina: string, params?: URLSearchParams | Record<string, string>): string {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params || {});
  for (const [k, v] of [...p.entries()]) if (v === '') p.delete(k);
  const q = p.toString();
  return '#/' + pagina + (q ? '?' + q : '');
}

export function navegar(pagina: string, params?: URLSearchParams | Record<string, string>, substituir = false) {
  const h = montarHash(pagina, params);
  if (substituir) window.history.replaceState(null, '', h);
  else window.history.pushState(null, '', h);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRota(): Rota & { mudarParams: (mudanca: Record<string, string | null>) => void } {
  const [rota, setRota] = useState<Rota>(lerRota);
  useEffect(() => {
    const f = () => setRota(lerRota());
    window.addEventListener('hashchange', f);
    window.addEventListener('popstate', f);
    return () => { window.removeEventListener('hashchange', f); window.removeEventListener('popstate', f); };
  }, []);
  const mudarParams = useCallback((mudanca: Record<string, string | null>) => {
    const atual = lerRota();
    const p = new URLSearchParams(atual.params);
    for (const [k, v] of Object.entries(mudanca)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    navegar(atual.pagina, p, true);
  }, []);
  return { ...rota, mudarParams };
}
