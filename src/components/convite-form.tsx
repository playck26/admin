"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActions, FormCard } from "@/components/form-card";
import { ApiError, criarConvite, type ConviteCriado } from "@/lib/api-client";

/**
 * SPEC-009/REQ-002 — convite.
 *
 * Diferença para o cadastro direto: aqui **o aluno escolhe a própria
 * senha**, então nada trafega por WhatsApp além de um link de uso único e
 * prazo determinado. É o caminho preferível quando dá para esperar a
 * pessoa agir; o cadastro direto existe para quando não dá.
 */
export function ConviteForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convite, setConvite] = useState<ConviteCriado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const baseCliente =
    process.env.NEXT_PUBLIC_CLIENTE_URL ?? "https://app.playck.com.br";
  const link = convite ? `${baseCliente}/convite/${convite.token}` : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setConvite(
        await criarConvite({
          nome: nome || undefined,
          email: email || undefined,
          telefone: telefone || undefined,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível criar o convite.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Clipboard indisponível: o link continua visível para cópia manual.
    }
  }

  if (convite) {
    const mensagem = `Olá${nome ? `, ${nome}` : ""}! Use este link para criar seu acesso ao PlayCK:\n\n${link}\n\nO link vale por 7 dias e só pode ser usado uma vez.`;
    const linkWhatsapp = telefone
      ? `https://wa.me/${telefone.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`
      : null;

    return (
      <div className="flex flex-col gap-5 rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
        <div>
          <h2 className="text-lg font-semibold">Convite criado</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Envie o link abaixo. Quem receber cria a própria senha — você não
            precisa saber qual é.
          </p>
        </div>

        <code className="rounded-lg bg-[var(--color-surface-variant)] px-4 py-3 font-mono text-sm break-all select-all">
          {link}
        </code>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={copiar}>
            {copiado ? (
              <>
                <Check className="size-4" /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copiar link
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

        <p className="rounded-lg bg-[var(--color-surface-variant)] p-3 text-sm">
          <strong>O link aparece só agora</strong> e vale por 7 dias. Pode ser
          usado uma única vez — depois disso, é preciso gerar outro.
        </p>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setConvite(null)}>
            Criar outro convite
          </Button>
          <Button type="button" onClick={() => router.push("/pessoas/alunos")}>
            Concluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FormCard
      title="Convidar aluno"
      description="O aluno recebe um link, cria a própria senha e já entra aprovado."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">
            Nome{" "}
            <span className="font-normal text-[var(--color-on-surface-variant)]">
              (opcional — aparece na tela do convite)
            </span>
          </Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} className="h-11 px-4" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">
            Email{" "}
            <span className="font-normal text-[var(--color-on-surface-variant)]">
              (opcional — se preenchido, será o e-mail da conta)
            </span>
          </Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="h-11 px-4" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">
            Telefone{" "}
            <span className="font-normal text-[var(--color-on-surface-variant)]">
              (opcional — habilita o envio por WhatsApp)
            </span>
          </Label>
          <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={loading} className="h-11 px-4" />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        <FormActions
          submitLabel="Gerar convite"
          loadingLabel="Gerando..."
          loading={loading}
          onCancel={() => router.push("/pessoas/alunos")}
        />
      </form>
    </FormCard>
  );
}
