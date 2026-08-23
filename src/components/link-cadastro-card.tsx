"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import {
  ApiError,
  definirAutoCadastro,
  getMinhaEmpresa,
  type MinhaEmpresa,
} from "@/lib/api-client";

const CLIENTE_URL =
  process.env.NEXT_PUBLIC_CLIENTE_URL ?? "https://app.playck.com.br";

/**
 * DEF-003 — o link de auto-cadastro, onde o gestor consegue achá-lo.
 *
 * A SPEC-009 subiu `/cadastro/<slug>` e a ADR-013 desenhou a divulgação
 * como "a empresa divulga o link". Faltava a parte em que a empresa
 * descobre qual é o link: o `slug` não aparecia em tela nenhuma, e a rota
 * que o continha era exclusiva do super admin.
 */
export function LinkCadastroCard() {
  const [empresa, setEmpresa] = useState<MinhaEmpresa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getMinhaEmpresa()
      .then(setEmpresa)
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        ),
      );
  }, []);

  if (erro) {
    return (
      <p role="alert" className="text-sm text-[var(--color-error)]">
        {erro}
      </p>
    );
  }

  if (!empresa) {
    return null;
  }

  const link = `${CLIENTE_URL}/cadastro/${empresa.slug}`;

  async function alternar() {
    if (!empresa) return;
    setErro(null);
    setSalvando(true);
    try {
      setEmpresa(await definirAutoCadastro(!empresa.permiteAutoCadastro));
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível salvar.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Navegador sem permissão de área de transferência (ou HTTP puro):
      // o link continua visível e selecionável na tela, que é o que
      // importa. Falhar em silêncio aqui é melhor que um alerta de erro
      // para uma conveniência.
      setCopiado(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center gap-2">
        <Link2 className="size-5 text-[var(--color-primary)]" />
        <h2 className="text-lg font-semibold">Link de cadastro de alunos</h2>
      </div>
      <p className="mt-1 max-w-xl text-sm text-[var(--color-on-surface-variant)]">
        Envie este link para quem quiser criar conta. Quem se cadastra por
        ele entra como <strong>pendente</strong> e só passa a reservar quadra
        ou entrar em turma depois que você aprovar.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--color-surface-variant)] px-3 py-2 text-sm break-all">
          {link}
        </code>
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)]"
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/* DEF-004 — o interruptor que a SPEC-009/REQ-006 prometeu. Antes
          desta tela, `permite_auto_cadastro` era lida em dois lugares e
          escrita em nenhum: a empresa "decidia" sobre algo congelado no
          default. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-outline)] pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {empresa.permiteAutoCadastro
              ? "Link ligado — qualquer pessoa com ele pode se cadastrar"
              : "Link desligado — ele responde como se não existisse"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-on-surface-variant)]">
            {empresa.permiteAutoCadastro
              ? "Quem entra por aqui fica pendente até você aprovar. Desligue se estiver recebendo cadastro indesejado."
              : "Novos alunos só entram por convite ou cadastrados por você."}
          </p>
        </div>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void alternar()}
          className="inline-flex h-10 shrink-0 items-center rounded-lg border border-[var(--color-outline)] px-4 text-sm font-semibold disabled:opacity-60"
        >
          {salvando
            ? "Salvando..."
            : empresa.permiteAutoCadastro
              ? "Desligar"
              : "Ligar"}
        </button>
      </div>
    </div>
  );
}
