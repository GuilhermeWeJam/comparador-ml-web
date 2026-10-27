import { useState, type ReactNode } from "react";
import { Botao } from "../componentes/ui";
import { useDados } from "../dados/store";
import { erroDe, supabase } from "../dados/supabase";

function Caixa({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <img src="./icone.svg" alt="" className="mx-auto mb-4 h-12 w-12" />
        {children}
      </div>
    </div>
  );
}

export function Entrar() {
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  async function entrar() {
    setIndo(true);
    setErro(null);
    const volta = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: volta },
    });
    if (error) {
      setErro(erroDe(error));
      setIndo(false);
    }
  }
  return (
    <Caixa>
      <h1 className="text-xl font-semibold">Comparador ML</h1>
      <p className="mt-2 text-sm text-slate-600">
        Escolha dos produtos para anunciar no Mercado Livre.
      </p>
      <Botao
        variante="primario"
        className="mt-6 w-full"
        onClick={entrar}
        disabled={indo}
      >
        {indo ? "Abrindo o Google…" : "Entrar com Google"}
      </Botao>
      {erro && <p className="mt-4 text-sm text-red-700">{erro}</p>}
    </Caixa>
  );
}

export function SemAcesso() {
  const { email, sair } = useDados();
  return (
    <Caixa>
      <h1 className="text-xl font-semibold">Acesso não liberado</h1>
      <p className="mt-2 text-sm text-slate-600">
        O e-mail <b>{email}</b> não está na lista de acesso. Só os dois e-mails
        cadastrados no banco entram no sistema.
      </p>
      <Botao className="mt-6 w-full" onClick={() => sair()}>
        Sair e entrar com outra conta
      </Botao>
    </Caixa>
  );
}

export function NaoConfigurado() {
  return (
    <Caixa>
      <h1 className="text-xl font-semibold">Falta configurar o Supabase</h1>
      <p className="mt-2 text-left text-sm text-slate-600">
        Crie o arquivo{" "}
        <code className="rounded bg-slate-100 px-1">.env.local</code> (copie de{" "}
        <code className="rounded bg-slate-100 px-1">.env.example</code>) com{" "}
        <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> e{" "}
        <code className="rounded bg-slate-100 px-1">
          VITE_SUPABASE_PUBLISHABLE_KEY
        </code>
        . No GitHub, essas duas ficam em Settings → Secrets and variables →
        Actions → Variables. O passo a passo está no LEIA-ME.
      </p>
    </Caixa>
  );
}
