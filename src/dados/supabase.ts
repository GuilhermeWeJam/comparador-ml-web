import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && chave);

// PKCE: o login do Google volta com "?code=" (não mexe no "#/" das rotas do site).
export const supabase = createClient(url || 'https://configure.supabase.co', chave || 'configure', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Lê todas as linhas de uma consulta, de 1.000 em 1.000 (limite padrão do Supabase). */
export async function lerTudo<T>(
  montar: () => { range: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
): Promise<T[]> {
  const out: T[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await montar().range(de, de + passo - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return out;
}

export function erroDe(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return String(e);
}
