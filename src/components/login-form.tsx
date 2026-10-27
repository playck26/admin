"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/api-client";
import { saveAccessToken, saveAdminUser } from "@/lib/auth-storage";

/**
 * SPEC-090 (D9) — **o protocolo entre a redefinição de senha e o login.**
 *
 * Depois do `204`, a página do link manda para cá com este endereço, e o
 * login mostra `TEXTO_SENHA_REDEFINIDA`. A constante mora **só aqui**, no
 * lado de quem lê: a página da redefinição a importa, e não escreve o
 * literal de novo — duas cópias divergiriam em silêncio, e o aviso deixaria
 * de aparecer sem nenhum teste notar.
 */
export const CHAVE_SENHA_REDEFINIDA = "senha";
export const VALOR_SENHA_REDEFINIDA = "redefinida";
export const LOGIN_APOS_REDEFINICAO = `/login?${CHAVE_SENHA_REDEFINIDA}=${VALOR_SENHA_REDEFINIDA}`;
export const TEXTO_SENHA_REDEFINIDA = "Senha redefinida. Entre com a senha nova.";

/**
 * Valor exato, como o `chegouDaAtivacao` do Cliente: `?senha=qualquer-coisa`
 * não mostra aviso. Quem digita o endereço à mão não ganha um "redefinida"
 * que não aconteceu.
 */
function chegouDaRedefinicao(busca: string): boolean {
  return new URLSearchParams(busca).get(CHAVE_SENHA_REDEFINIDA) === VALOR_SENHA_REDEFINIDA;
}

/**
 * Quanto esperar depois da montagem para pôr o texto na região viva — o
 * mesmo `ATRASO_DO_ANUNCIO_MS` do `AvisoDeAtivacao` do Cliente. Não é para o
 * olho: é para o leitor de tela já ter registrado a região quando o conteúdo
 * chegar. Exportado para o teste medir o atraso, e não adivinhá-lo.
 */
export const ATRASO_DO_ANUNCIO_MS = 150;

export function LoginForm() {
  const router = useRouter();
  /**
   * Lido em efeito, por `window.location.search`, **sem `useSearchParams`**:
   * o hook exigiria `Suspense` na página do login, que é estática. A região
   * do aviso existe desde o servidor e começa **vazia**; o texto entra depois
   * de hidratar, e mais `ATRASO_DO_ANUNCIO_MS`. Uma região viva que muda
   * junto com a própria montagem costuma não ser anunciada; a que muda
   * depois, sim (REV-090-F02).
   *
   * O `setState` mora dentro do `setTimeout`, e não no corpo do efeito: é o
   * atraso que torna o anúncio confiável, e é o que mantém o
   * `react-hooks/set-state-in-effect` satisfeito sem desligá-lo.
   */
  const [senhaRedefinida, setSenhaRedefinida] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSenhaRedefinida(chegouDaRedefinicao(window.location.search));
    }, ATRASO_DO_ANUNCIO_MS);
    return () => window.clearTimeout(id);
  }, []);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email, senha });
      saveAccessToken(result.accessToken);
      // `email` aqui é o estado do formulário (o que o usuário digitou),
      // não `result.usuario.email` — LoginResult.usuario não tem esse
      // campo. Login só teve sucesso se as credenciais bateram, então é
      // o mesmo e-mail da conta autenticada (achado da validação
      // cruzada, Codex — esclarecendo para não parecer leitura de um
      // campo que não existe no tipo).
      saveAdminUser({ nome: result.usuario.nome, email });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0 w-full overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-surface-container-lowest)] p-7 shadow-[var(--shadow-lift)] sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-5 flex size-20 items-center justify-center rounded-xl bg-white shadow-[var(--shadow-low)] ring-1 ring-border">
          <Image src="/playck-logo.png" alt="PlayCK" width={72} height={72} className="size-[70px] object-contain" priority />
        </div>
        <p className="text-xs font-bold tracking-[0.15em] text-[var(--color-primary-strong)] uppercase">Gestão da arena</p>
        <h1 className="mt-2 text-[28px] leading-tight font-extrabold text-[var(--color-on-surface)]">Bem-vindo de volta</h1>
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Entre para acompanhar a operação da sua escola.</p>
      </div>

      {/*
        Uma região de status só, sempre presente: o leitor de tela anuncia o
        texto quando ele entra, e a página não muda de forma no servidor.
      */}
      <p
        role="status"
        className={
          senhaRedefinida
            ? "mb-4 rounded-lg bg-[var(--color-primary-container)]/40 p-3 text-sm leading-snug text-[var(--color-on-surface)]"
            : undefined
        }
      >
        {senhaRedefinida ? TEXTO_SENHA_REDEFINIDA : null}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="senha">Senha</Label>
          <div className="relative">
            <Input
              id="senha"
              type={showSenha ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={loading}
              className="h-11 px-4 pr-11"
            />
            <button
              type="button"
              aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowSenha((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-outline)] hover:text-[var(--color-on-surface)]"
            >
              {showSenha ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {/* SPEC-090: leva ao pedido do link. Alvo de 44 px, foco visível. */}
          <Link
            href="/esqueci-senha"
            className="flex min-h-11 items-center self-end rounded-lg px-1 text-sm font-bold text-[var(--color-primary-strong)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Esqueceu a senha?
          </Link>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="mt-2 h-12 text-sm font-bold">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
