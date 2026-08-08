"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    return <p className="text-[var(--color-text-secondary)]">Carregando...</p>;
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Editar professor</CardTitle>
        <CardDescription>{teacher.status === "ativo" ? "Ativo" : "Inativo"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={loading} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>

        <hr className="border-border" />

        <Button
          type="button"
          variant={teacher.status === "ativo" ? "destructive" : "outline"}
          disabled={statusLoading}
          onClick={() => void handleToggleStatus()}
        >
          {statusLoading ? "Aplicando..." : teacher.status === "ativo" ? "Inativar professor" : "Reativar professor"}
        </Button>
      </CardContent>
    </Card>
  );
}
