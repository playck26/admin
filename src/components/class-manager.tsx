"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ApiError,
  allocateStudentInClass,
  getClass,
  listCourts,
  listLevels,
  listStudents,
  listTeachers,
  removeStudentFromClass,
  updateClass,
  type Court,
  type Level,
  type SchoolClassDetail,
  type Student,
  type Teacher,
} from "@/lib/api-client";
import { DIAS_SEMANA } from "@/lib/dias-semana";

const SEM_NIVEL = "sem-nivel";
const SEM_PROFESSOR = "sem-professor";

export function ClassManager({ id }: { id: string }) {
  const [turma, setTurma] = useState<SchoolClassDetail | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [quadraId, setQuadraId] = useState("");
  const [nivelId, setNivelId] = useState(SEM_NIVEL);
  const [professorId, setProfessorId] = useState(SEM_PROFESSOR);
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [novoAlunoId, setNovoAlunoId] = useState("");
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocError, setAllocError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function reload() {
    const turmaData = await getClass(id);
    setTurma(turmaData);
    setNome(turmaData.nome);
    setQuadraId(turmaData.quadraId);
    setNivelId(turmaData.nivelId ?? SEM_NIVEL);
    setProfessorId(turmaData.professorId ?? SEM_PROFESSOR);
    setDiaSemana(String(turmaData.diaSemana));
    setHoraInicio(turmaData.horaInicio);
    setHoraFim(turmaData.horaFim);
    setCapacidade(String(turmaData.capacidade));
    return turmaData;
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([reload(), listCourts(1, 100), listLevels(), listTeachers(1, 100), listStudents(1, 100)])
      .then(([, courtsData, levelsData, teachersData, studentsData]) => {
        setCourts(courtsData.data);
        setLevels(levelsData);
        setTeachers(teachersData.data);
        setStudents(studentsData.data);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a turma.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);
    setEditLoading(true);
    try {
      await updateClass(id, {
        nome,
        quadraId,
        nivelId: nivelId === SEM_NIVEL ? undefined : nivelId,
        professorId: professorId === SEM_PROFESSOR ? undefined : professorId,
        diaSemana: Number(diaSemana),
        horaInicio,
        horaFim,
        capacidade: Number(capacidade),
      });
      await reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleToggleStatus() {
    if (!turma) return;
    setStatusLoading(true);
    try {
      await updateClass(id, { status: turma.status === "ativa" ? "inativa" : "ativa" });
      await reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Não foi possível mudar o status.");
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleAllocate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!novoAlunoId) return;
    setAllocError(null);
    setAllocLoading(true);
    try {
      await allocateStudentInClass(id, novoAlunoId);
      setNovoAlunoId("");
      await reload();
    } catch (err) {
      setAllocError(err instanceof ApiError ? err.message : "Não foi possível alocar o aluno (capacidade excedida?).");
    } finally {
      setAllocLoading(false);
    }
  }

  async function handleRemove(alunoId: string) {
    setRemovingId(alunoId);
    setAllocError(null);
    try {
      await removeStudentFromClass(id, alunoId);
      await reload();
    } catch (err) {
      setAllocError(err instanceof ApiError ? err.message : "Não foi possível remover o aluno.");
    } finally {
      setRemovingId(null);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-[var(--color-error)]">
        {loadError}
      </p>
    );
  }

  if (!turma) {
    return <p className="text-[var(--color-text-secondary)]">Carregando...</p>;
  }

  const alocadosIds = new Set(turma.alunos.map((aluno) => aluno.alunoId));
  const disponiveis = students.filter((student) => !alocadosIds.has(student.id));
  const cheia = turma.alunosAlocados >= turma.capacidade;

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{turma.nome}</CardTitle>
            <Badge variant={turma.status === "ativa" ? "default" : "secondary"}>
              {turma.status === "ativa" ? "Ativa" : "Inativa"}
            </Badge>
          </div>
          <CardDescription>Editar dados da turma</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={editLoading} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="quadra">Quadra</Label>
              <Select value={quadraId} onValueChange={setQuadraId} disabled={editLoading}>
                <SelectTrigger id="quadra">
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
                <Select value={nivelId} onValueChange={setNivelId} disabled={editLoading}>
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="professor">Professor</Label>
                <Select value={professorId} onValueChange={setProfessorId} disabled={editLoading}>
                  <SelectTrigger id="professor">
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="diaSemana">Dia da semana</Label>
              <Select value={diaSemana} onValueChange={setDiaSemana} disabled={editLoading}>
                <SelectTrigger id="diaSemana">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((label, index) => (
                    <SelectItem key={label} value={String(index)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="horaInicio">Início</Label>
                <Input
                  id="horaInicio"
                  type="time"
                  required
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  disabled={editLoading}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="horaFim">Fim</Label>
                <Input
                  id="horaFim"
                  type="time"
                  required
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  disabled={editLoading}
                />
              </div>
            </div>

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
                disabled={editLoading}
              />
            </div>

            {editError ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {editError}
              </p>
            ) : null}

            <Button type="submit" disabled={editLoading}>
              {editLoading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>

          <hr className="border-border" />

          <Button
            type="button"
            variant={turma.status === "ativa" ? "destructive" : "outline"}
            disabled={statusLoading}
            onClick={() => void handleToggleStatus()}
          >
            {statusLoading ? "Aplicando..." : turma.status === "ativa" ? "Inativar turma" : "Reativar turma"}
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Alunos alocados</CardTitle>
          <CardDescription>
            {turma.alunosAlocados}/{turma.capacidade} vagas ocupadas
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {turma.alunos.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Nenhum aluno alocado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turma.alunos.map((aluno) => (
                    <TableRow key={aluno.alunoId}>
                      <TableCell className="font-medium">{aluno.nome}</TableCell>
                      <TableCell>{aluno.email}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={removingId === aluno.alunoId}
                          onClick={() => void handleRemove(aluno.alunoId)}
                        >
                          {removingId === aluno.alunoId ? "Removendo..." : "Remover"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <form onSubmit={handleAllocate} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
            <p className="text-sm font-medium text-foreground">Alocar aluno</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="novoAluno">Aluno</Label>
              <Select value={novoAlunoId} onValueChange={setNovoAlunoId} disabled={allocLoading || cheia}>
                <SelectTrigger id="novoAluno">
                  <SelectValue placeholder={cheia ? "Turma sem vagas" : "Selecione um aluno"} />
                </SelectTrigger>
                <SelectContent>
                  {disponiveis.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {allocError ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {allocError}
              </p>
            ) : null}
            <Button type="submit" disabled={allocLoading || !novoAlunoId || cheia}>
              {allocLoading ? "Alocando..." : "Alocar aluno"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
