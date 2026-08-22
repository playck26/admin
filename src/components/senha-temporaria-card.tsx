"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  nomeAluno: string;
  senha: string;
  telefone?: string | null;
  onConcluir: () => void;
  concluirLabel?: string;
}

/**
 * SPEC-009/AC-006 — a senha temporária existe em texto claro **uma única
 * vez**, nesta resposta da API. Nenhuma outra rota a devolve.
 *
 * Por isso a tela não navega sozinha depois de criar o aluno: se ela
 * seguisse direto para a listagem, a senha se perderia e o admin teria que
 * gerar outra. Sair daqui é escolha explícita de quem já copiou.
 */
export function SenhaTemporariaCard({
  nomeAluno,
  senha,
  telefone,
  onConcluir,
  concluirLabel = "Concluir",
}: Props) {
  const [copiado, setCopiado] = useState(false);

  const mensagem = `Olá, ${nomeAluno}! Seu acesso ao PlayCK está pronto.\n\nSenha temporária: ${senha}\n\nNo primeiro acesso você vai criar sua própria senha. Ela vale por 7 dias.`;
  const linkWhatsapp = telefone
    ? `https://wa.me/${telefone.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`
    : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Clipboard bloqueado (contexto inseguro ou permissão negada): a
      // senha continua visível na tela para cópia manual, então não há
      // erro a mostrar — só não confirmamos a cópia.
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Aluno criado</h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Envie esta senha para {nomeAluno}. No primeiro acesso, o aluno cria a
          própria senha.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-[var(--color-on-surface-variant)] uppercase">
          Senha temporária
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <code
            data-testid="senha-temporaria"
            className="rounded-lg bg-[var(--color-surface-variant)] px-4 py-3 font-mono text-2xl tracking-widest select-all"
          >
            {senha}
          </code>
          <Button type="button" variant="outline" onClick={copiar}>
            {copiado ? (
              <>
                <Check className="size-4" /> Copiada
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copiar
              </>
            )}
          </Button>
          {linkWhatsapp ? (
            <Button asChild type="button" variant="outline">
              <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> Enviar no WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <p className="rounded-lg bg-[var(--color-surface-variant)] p-3 text-sm">
        <strong>Esta senha aparece só agora.</strong> Ela vale por 7 dias e não
        pode ser consultada depois — se precisar, gere uma nova na ficha do
        aluno.
      </p>

      <div className="flex justify-end">
        <Button type="button" onClick={onConcluir}>
          {concluirLabel}
        </Button>
      </div>
    </div>
  );
}
