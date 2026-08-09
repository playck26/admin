"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { ApiError, login } from "@/lib/api-client";
import { saveAccessToken, saveAdminUser } from "@/lib/auth-storage";

export function LoginForm() {
  const router = useRouter();
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
    <div className="w-full max-w-[420px] rounded-2xl bg-[var(--color-surface-container-lowest)] p-8 shadow-[var(--shadow-elevated)]">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-[var(--color-primary-container)]">
          <TennisBallIcon className="size-7 text-[var(--color-on-primary-container)]" />
        </div>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-[var(--color-on-surface)]">
          Entrar
        </h1>
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
          Painel do dono da escola/arena — PlayCK
        </p>
      </div>

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
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="mt-2 h-11 text-[13px] font-semibold">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
