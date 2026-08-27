"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormActions, FormCard } from "@/components/form-card";
import {
  ApiError,
  createClass,
  listCourts,
  listLevels,
  listTeachers,
  type Court,
  type Level,
  type Teacher,
} from "@/lib/api-client";
import {
  EncontrosField,
  ENCONTRO_VAZIO,
  paraEnvio,
  type EncontroForm,
} from "@/components/encontros-field";

const SEM_NIVEL = "sem-nivel";
const SEM_PROFESSOR = "sem-professor";

export function CreateClassForm() {
  const router = useRouter();
  const [courts, setCourts] = useState<Court[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [quadraId, setQuadraId] = useState("");
  const [nivelId, setNivelId] = useState(SEM_NIVEL);
  const [professorId, setProfessorId] = useState(SEM_PROFESSOR);
  // SPEC-019/TASK-004 — os três campos soltos viraram uma lista. A turma
  // nasce com UM encontro, que é o caso comum e mantém a tela idêntica à de
  // antes para quem só quer um dia.
  const [encontros, setEncontros] = useState<EncontroForm[]>([
    { ...ENCONTRO_VAZIO },
  ]);
  const [capacidade, setCapacidade] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCourts(1, 100), listLevels(), listTeachers(1, 100)])
      .then(([courtsData, levelsData, teachersData]) => {
        setCourts(courtsData.data);
        setLevels(levelsData);
        setTeachers(teachersData.data);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar quadras/níveis/professores.");
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createClass({
        nome,
        quadraId,
        nivelId: nivelId === SEM_NIVEL ? undefined : nivelId,
        professorId: professorId === SEM_PROFESSOR ? undefined : professorId,
        encontros: paraEnvio(encontros),
        capacidade: Number(capacidade),
      });
      router.push("/turmas");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar a turma.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormCard
      title="Nova turma"
      description="Horário recorrente semanal — as próximas 8 semanas de ocupação são geradas automaticamente"
    >
      {loadError ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {loadError}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              placeholder="Turma Iniciante Terça 14h"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={loading}
              className="h-11 px-4"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quadra">Quadra</Label>
            <Select value={quadraId} onValueChange={setQuadraId} disabled={loading}>
              <SelectTrigger id="quadra" className="h-11 w-full px-4">
                <SelectValue placeholder="Selecione uma quadra" />
              </SelectTrigger>
              <SelectContent>
                {courts.map((quadra) => (
                  <SelectItem key={quadra.id} value={quadra.id}>
                    {quadra.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nivel">Nível</Label>
              <Select value={nivelId} onValueChange={setNivelId} disabled={loading}>
                <SelectTrigger id="nivel" className="h-11 w-full px-4">
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="professor">Professor</Label>
              <Select value={professorId} onValueChange={setProfessorId} disabled={loading}>
                <SelectTrigger id="professor" className="h-11 w-full px-4">
                  <SelectValue placeholder="Sem professor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PROFESSOR}>Sem professor</SelectItem>
                  {teachers.map((professor) => (
                    <SelectItem key={professor.id} value={professor.id}>
                      {professor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <EncontrosField
            encontros={encontros}
            onChange={setEncontros}
            disabled={loading}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="capacidade">Capacidade</Label>
            <Input
              id="capacidade"
              type="number"
              min="1"
              step="1"
              required
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
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
            submitLabel="Criar turma"
            loadingLabel="Criando..."
            loading={loading}
            submitDisabled={!quadraId}
            onCancel={() => router.push("/turmas")}
          />
        </form>
      )}
    </FormCard>
  );
}
