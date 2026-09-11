"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeletorDeAluno } from "@/components/seletor-de-aluno";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
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
import {
  EncontrosField,
  ENCONTRO_VAZIO,
  paraEnvio,
  type EncontroForm,
} from "@/components/encontros-field";
import { TurmaChamadaAbas } from "@/components/turma-chamada-abas";
import { AulasCanceladasDaTurma } from "@/components/aulas-canceladas-da-turma";

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
  // SPEC-019/TASK-004 — os três campos soltos viraram uma lista.
  const [encontros, setEncontros] = useState<EncontroForm[]>([
    { ...ENCONTRO_VAZIO },
  ]);
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
    // `?? []` seguido de fallback para um encontro vazio: turma sem
    // encontro nenhum não deveria existir (INV-051), mas se existir a tela
    // abre editável em vez de abrir vazia e travada.
    setEncontros(
      turmaData.encontros.length > 0
        ? turmaData.encontros.map((encontro) => ({
            diaSemana: String(encontro.diaSemana),
            horaInicio: encontro.horaInicio,
            horaFim: encontro.horaFim,
          }))
        : [{ ...ENCONTRO_VAZIO }],
    );
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
        encontros: paraEnvio(encontros),
        capacidade: Number(capacidade),
      });
      await reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setEditLoading(false);
    }
  }

  /**
   * SPEC-035 — **o botão que não fazia nada passou a fazer duas coisas.**
   *
   * Até 2026-09-09 o back gravava o `status` e mais nada: inativar a turma
   * deixava a quadra bloqueada para sempre, apontando para uma turma fora de
   * operação. Agora inativar **cancela as ocupações futuras** e reativar
   * **regenera a grade** — e é a regeneração que pode ser recusada.
   *
   * A recusa vem com a lista inteira de conflitos (`conflicts`), e não com o
   * primeiro: o gestor vê o estrago todo em vez de descobrir o segundo depois
   * de resolver o primeiro. **É o "recusar com aviso" que o item 13 do
   * backlog pediu** — sem a contagem, a mensagem crua do servidor não diz nem
   * quantas.
   */
  async function handleToggleStatus() {
    if (!turma) return;
    const reativando = turma.status !== "ativa";
    setEditError(null);
    setStatusLoading(true);
    try {
      await updateClass(id, { status: reativando ? "ativa" : "inativa" });
      await reload();
    } catch (err) {
      const conflitos = err instanceof ApiError ? (err.conflicts ?? []) : [];
      setEditError(
        conflitos.length > 0
          ? `Não dá para reativar: ${conflitos.length === 1 ? "um horário da turma já foi ocupado" : `${conflitos.length} horários da turma já foram ocupados`}. Libere a quadra ou mude a recorrência antes de reativar.`
          : err instanceof ApiError
            ? err.message
            : "Não foi possível mudar o status.",
      );
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
    return <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>;
  }

  const alocadosIds = new Set(turma.alunos.map((aluno) => aluno.alunoId));
  // SPEC-049 — `disponiveis` saiu: quem recorta "ja alocado" agora e o
  // `SeletorDeAluno`, pelo `excluir`, sobre o RESULTADO DA BUSCA. Filtrar aqui
  // so alcancaria os 100 que vinham antes.
  const cheia = turma.alunosAlocados >= turma.capacidade;

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2 flex items-center gap-4">
        <Link
          href="/turmas"
          className="-ml-2 rounded-full p-2 text-[var(--color-on-surface-variant)] transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-[var(--color-on-surface)]">
          Gerenciar Turma
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)] lg:col-span-7">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">{turma.nome}</h2>
            <StatusBadge ativo={turma.status === "ativa"} activeLabel="Ativa" inactiveLabel="Inativa" />
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={editLoading}
                className="h-10 px-3"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="quadra">Quadra</Label>
              <Select value={quadraId} onValueChange={setQuadraId} disabled={editLoading}>
                <SelectTrigger id="quadra" className="h-10 w-full px-3">
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
              <div className="flex flex-col gap-1">
                <Label htmlFor="nivel">Nível</Label>
                <Select value={nivelId} onValueChange={setNivelId} disabled={editLoading}>
                  <SelectTrigger id="nivel" className="h-10 w-full px-3">
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
              <div className="flex flex-col gap-1">
                <Label htmlFor="professor">Professor</Label>
                <Select value={professorId} onValueChange={setProfessorId} disabled={editLoading}>
                  <SelectTrigger id="professor" className="h-10 w-full px-3">
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
              disabled={editLoading}
            />

            <div className="flex flex-col gap-1 md:w-1/3">
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
                className="h-10 px-3"
              />
            </div>

            {editError ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {editError}
              </p>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={editLoading} className="h-10 px-6 text-[13px] font-semibold">
                {editLoading ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>

          <hr className="my-6 border-border" />

          <Button
            type="button"
            variant="outline"
            disabled={statusLoading}
            onClick={() => void handleToggleStatus()}
            className={
              turma.status === "ativa"
                ? "h-10 gap-2 border-[1.5px] border-[var(--color-error)] px-5 text-[13px] font-semibold text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
                : "h-10 gap-2 border-[1.5px] border-primary px-5 text-[13px] font-semibold text-primary hover:bg-primary/5"
            }
          >
            <Ban className="size-4" />
            {statusLoading ? "Aplicando..." : turma.status === "ativa" ? "Inativar turma" : "Reativar turma"}
          </Button>

          <hr className="my-6 border-border" />

          {/*
            SPEC-035/TASK-004 — a PORTA da reativação de uma aula.

            Mora aqui, e não na agenda, porque a agenda esconde o cancelado —
            e quem investiga "por que sumiu a aula de terça" abre a turma.
          */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
              Aulas canceladas
            </h3>
            <AulasCanceladasDaTurma turmaId={id} />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)] lg:col-span-5">
          <div>
            <TurmaChamadaAbas turmaId={id} />

            <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">Alunos alocados</h2>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              {turma.alunosAlocados}/{turma.capacidade} vagas ocupadas
            </p>
          </div>

          {turma.alunos.length === 0 ? (
            <p className="text-sm text-[var(--color-on-surface-variant)]">Nenhum aluno alocado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-[var(--color-on-surface-variant)]">Nome</TableHead>
                    <TableHead className="text-xs font-medium text-[var(--color-on-surface-variant)]">Email</TableHead>
                    <TableHead className="text-right text-xs font-medium text-[var(--color-on-surface-variant)]">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turma.alunos.map((aluno) => (
                    <TableRow key={aluno.alunoId} className="border-border">
                      <TableCell className="font-medium text-[var(--color-on-surface)]">{aluno.nome}</TableCell>
                      <TableCell className="text-[var(--color-on-surface-variant)]">{aluno.email}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={removingId === aluno.alunoId}
                          onClick={() => void handleRemove(aluno.alunoId)}
                          className="h-7 border-primary px-3 text-xs text-primary hover:bg-primary/5"
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

          <form onSubmit={handleAllocate} className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-semibold text-[var(--color-on-surface)]">Alocar aluno</p>
            <div className="flex gap-3">
              {/*
                SPEC-049/REQ-002 — busca no servidor, com `excluir` para não
                oferecer quem já está na turma. O recorte de "já alocado" é no
                cliente de propósito: é uma lista do tamanho da turma. **O que
                não podia ser no cliente era a BUSCA.**
              */}
              <div className="flex-1">
                <SeletorDeAluno
                  id="novoAluno"
                  label={cheia ? "Turma sem vagas" : "Aluno"}
                  valor={novoAlunoId}
                  onEscolher={setNovoAlunoId}
                  disabled={allocLoading || cheia}
                  excluir={[...alocadosIds]}
                />
              </div>
              <Button
                type="submit"
                disabled={allocLoading || !novoAlunoId || cheia}
                className="h-10 shrink-0 px-5 text-[13px] font-semibold whitespace-nowrap"
              >
                {allocLoading ? "Alocando..." : "Alocar aluno"}
              </Button>
            </div>
            {allocError ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {allocError}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
