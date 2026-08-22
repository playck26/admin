"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActions, FormCard } from "@/components/form-card";
import { ApiError, createStudent, type StudentComSenha } from "@/lib/api-client";
import { SenhaTemporariaCard } from "@/components/senha-temporaria-card";

export function CreateStudentForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criado, setCriado] = useState<StudentComSenha | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Não navega direto: a senha temporária vem só nesta resposta
      // (AC-006). Sair da tela sem mostrá-la seria perdê-la.
      const aluno = await createStudent({
        nome,
        email,
        telefone: telefone || undefined,
      });
      setCriado(aluno);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o aluno.");
    } finally {
      setLoading(false);
    }
  }

  if (criado) {
    return (
      <SenhaTemporariaCard
        nomeAluno={criado.nome}
        senha={criado.senhaTemporaria}
        telefone={criado.telefone}
        onConcluir={() => router.push("/pessoas/alunos")}
        concluirLabel="Ir para a lista de alunos"
      />
    );
  }

  return (
    <FormCard
      title="Novo aluno"
      description="O sistema gera uma senha temporária para o aluno entrar. Ela aparece uma única vez, ao criar."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">
            Nome <span className="text-[var(--color-tertiary)]">*</span>
          </Label>
          <Input
            id="nome"
            placeholder="Nome completo do aluno"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">
            Email <span className="text-[var(--color-tertiary)]">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="email@exemplo.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">
            Telefone <span className="font-normal text-[var(--color-on-surface-variant)]">(opcional)</span>
          </Label>
          <div className="relative">
            <Phone className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-outline)]" />
            <Input
              id="telefone"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              disabled={loading}
              className="h-11 pr-4 pl-10"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        <FormActions
          submitLabel="Criar aluno"
          loadingLabel="Criando..."
          loading={loading}
          onCancel={() => router.push("/pessoas/alunos")}
        />
      </form>
    </FormCard>
  );
}
