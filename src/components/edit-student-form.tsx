"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormActions, FormCard } from "@/components/form-card";
import {
  ApiError,
  getStudent,
  listLevels,
  regenerarSenhaTemporaria,
  updateStudent,
  type Level,
  type Student,
  type StudentComSenha,
} from "@/lib/api-client";
import { SenhaTemporariaCard } from "@/components/senha-temporaria-card";
import { Button } from "@/components/ui/button";
import { Ban } from "lucide-react";

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
  const [senhaNova, setSenhaNova] = useState<StudentComSenha | null>(null);
  const [gerandoSenha, setGerandoSenha] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

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

  /**
   * DEF-027 — **o botão que faltava.**
   *
   * O Admin tem "Inativar" para turma, quadra, professor e plano. Para ALUNO
   * não tinha nenhum — e é justamente o gesto que o back manda usar: recusar
   * o vínculo de um aluno já aprovado responde *"use inativação (status)"*.
   * O gestor era mandado para uma porta que a tela não abria.
   *
   * `err.message` inteiro na tela, e não uma frase genérica: com compromisso
   * marcado o back responde `409 ALUNO_COM_COMPROMISSOS` **dizendo quantos
   * são** e que cancelar devolve o crédito. Trocar isso por "não foi possível"
   * seria o defeito do DEF-025 de novo — a tela sabendo menos que a resposta.
   */
  async function handleToggleStatus() {
    if (!student) return;
    setStatusLoading(true);
    setError(null);
    try {
      const novoStatus = student.status === "ativo" ? "inativo" : "ativo";
      const atualizado = await updateStudent(id, { status: novoStatus });
      setStudent(atualizado);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível mudar o status.",
      );
    } finally {
      setStatusLoading(false);
    }
  }

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
    return <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>;
  }

  if (senhaNova) {
    return (
      <SenhaTemporariaCard
        nomeAluno={senhaNova.nome}
        senha={senhaNova.senhaTemporaria}
        telefone={senhaNova.telefone}
        onConcluir={() => setSenhaNova(null)}
        concluirLabel="Voltar para a ficha"
      />
    );
  }

  return (
    <FormCard title="Editar aluno" description={student.email}>
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

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        ) : null}

        <FormActions
          submitLabel="Salvar alterações"
          loadingLabel="Salvando..."
          loading={loading}
          onCancel={() => router.push("/pessoas/alunos")}
        />
      </form>

      {/*
        SPEC-009/REQ-005 — enquanto não houver e-mail transacional
        (GAP-004), este botão **é** o "esqueci minha senha" do aluno: ele
        pede ao admin, que gera outra e reencaminha (ADR-013).
      */}
      <div className="mt-8 flex flex-col gap-3 border-t border-[var(--color-outline)] pt-6">
        <div>
          <h3 className="text-sm font-semibold">Acesso do aluno</h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Gere uma senha temporária se o aluno não conseguir entrar. A
            anterior deixa de valer e as sessões abertas são encerradas.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={gerandoSenha}
            onClick={() => {
              setError(null);
              setGerandoSenha(true);
              regenerarSenhaTemporaria(id)
                .then(setSenhaNova)
                .catch((err: unknown) =>
                  setError(
                    err instanceof ApiError
                      ? err.message
                      : "Não foi possível gerar uma senha nova.",
                  ),
                )
                .finally(() => setGerandoSenha(false));
            }}
          >
            {gerandoSenha ? "Gerando..." : "Gerar nova senha temporária"}
          </Button>
        </div>
      </div>

      {/*
        DEF-027 — desligar um aluno que já opera. `vinculo` é outra coisa:
        recusar cadastro é para quem ainda não foi aprovado, e o back recusa
        aplicá-lo a quem já opera, apontando para cá.
      */}
      <div className="mt-8 flex flex-col gap-3 border-t border-[var(--color-outline)] pt-6">
        <div>
          <h3 className="text-sm font-semibold">Situação no clube</h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            {student.status === "ativo"
              ? "Desligar encerra o acesso do aluno e o impede de ser matriculado, reservado ou alocado em turma. Reservas futuras precisam ser canceladas antes — cancelar devolve o crédito."
              : "Este aluno está desligado: não entra no app e não pode ser matriculado, reservado nem alocado em turma."}
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={statusLoading}
            onClick={() => void handleToggleStatus()}
            className={
              student.status === "ativo"
                ? "h-11 gap-2 border-[1.5px] border-[var(--color-error)] px-6 text-[13px] font-semibold text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
                : "h-11 gap-2 border-[1.5px] border-primary px-6 text-[13px] font-semibold text-primary hover:bg-primary/5"
            }
          >
            <Ban className="size-4" />
            {statusLoading
              ? "Aplicando..."
              : student.status === "ativo"
                ? "Desligar aluno"
                : "Reativar aluno"}
          </Button>
        </div>
      </div>
    </FormCard>
  );
}
