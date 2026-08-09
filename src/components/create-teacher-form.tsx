"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActions, FormCard } from "@/components/form-card";
import { ApiError, createTeacher } from "@/lib/api-client";

export function CreateTeacherForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createTeacher({ nome, telefone: telefone || undefined, email: email || undefined });
      router.push("/pessoas/professores");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o professor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormCard title="Novo professor" description="Sem login no MVP — só dado de contato">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">
            Telefone <span className="font-normal text-[var(--color-on-surface-variant)]">(opcional)</span>
          </Label>
          <Input
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">
            Email <span className="font-normal text-[var(--color-on-surface-variant)]">(opcional)</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        <FormActions
          submitLabel="Criar professor"
          loadingLabel="Criando..."
          loading={loading}
          onCancel={() => router.push("/pessoas/professores")}
        />
      </form>
    </FormCard>
  );
}
