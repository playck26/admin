"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActions, FormCard } from "@/components/form-card";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, getTeacher, updateTeacher, type Teacher } from "@/lib/api-client";

export function EditTeacherForm({ id }: { id: string }) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTeacher(id)
      .then((data) => {
        setTeacher(data);
        setNome(data.nome);
        setTelefone(data.telefone ?? "");
        setEmail(data.email ?? "");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar o professor.");
      });
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const updated = await updateTeacher(id, {
        nome,
        telefone: telefone || undefined,
        email: email || undefined,
      });
      setTeacher(updated);
      router.push("/pessoas/professores");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus() {
    if (!teacher) return;
    setStatusLoading(true);
    setError(null);
    try {
      const novoStatus = teacher.status === "ativo" ? "inativo" : "ativo";
      const updated = await updateTeacher(id, { status: novoStatus });
      setTeacher(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mudar o status.");
    } finally {
      setStatusLoading(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-[var(--color-error)]">
        {loadError}
      </p>
    );
  }

  if (!teacher) {
    return <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>;
  }

  return (
    <FormCard
      title="Editar professor"
      description={<StatusBadge ativo={teacher.status === "ativo"} />}
    >
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
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            disabled={loading}
            className="h-11 px-4"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
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
          submitLabel="Salvar alterações"
          loadingLabel="Salvando..."
          loading={loading}
          onCancel={() => router.push("/pessoas/professores")}
        />
      </form>

      <hr className="my-6 border-border" />

      <Button
        type="button"
        variant="outline"
        disabled={statusLoading}
        onClick={() => void handleToggleStatus()}
        className={
          teacher.status === "ativo"
            ? "h-11 gap-2 border-[1.5px] border-[var(--color-error)] px-6 text-[13px] font-semibold text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
            : "h-11 gap-2 border-[1.5px] border-primary px-6 text-[13px] font-semibold text-primary hover:bg-primary/5"
        }
      >
        <Ban className="size-4" />
        {statusLoading ? "Aplicando..." : teacher.status === "ativo" ? "Inativar professor" : "Reativar professor"}
      </Button>
    </FormCard>
  );
}
