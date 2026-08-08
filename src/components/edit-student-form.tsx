"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, getStudent, listLevels, updateStudent, type Level, type Student } from "@/lib/api-client";

const SEM_NIVEL = "sem-nivel";

export function EditStudentForm({ id }: { id: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nivelId, setNivelId] = useState<string>(SEM_NIVEL);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStudent(id), listLevels()])
      .then(([studentData, levelsData]) => {
        setStudent(studentData);
        setLevels(levelsData);
        setNome(studentData.nome);
        setTelefone(studentData.telefone ?? "");
        setNivelId(studentData.nivelId ?? SEM_NIVEL);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar o aluno.");
      });
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateStudent(id, {
        nome,
        telefone: telefone || undefined,
        nivelId: nivelId === SEM_NIVEL ? undefined : nivelId,
      });
      router.push("/pessoas/alunos");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setLoading(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-[var(--color-error)]">
        {loadError}
      </p>
    );
  }

  if (!student) {
    return <p className="text-[var(--color-text-secondary)]">Carregando...</p>;
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Editar aluno</CardTitle>
        <CardDescription>{student.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nivel">Nível</Label>
            <Select value={nivelId} onValueChange={setNivelId} disabled={loading}>
              <SelectTrigger id="nivel">
                <SelectValue placeholder="Sem nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_NIVEL}>Sem nível</SelectItem>
                {levels.map((nivel) => (
                  <SelectItem key={nivel.id} value={nivel.id}>
                    {nivel.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      </CardContent>
    </Card>
  );
}
