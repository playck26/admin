"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FotoDoProfessor } from "@/components/foto-do-professor";
import { useRouter } from "next/navigation";
import { Ban, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActions, FormCard } from "@/components/form-card";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  gerarAcessoProfessor,
  getTeacher,
  updateTeacher,
  type Teacher,
  type TeacherComSenha,
} from "@/lib/api-client";
import { SenhaTemporariaCard } from "@/components/senha-temporaria-card";

export function EditTeacherForm({ id }: { id: string }) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [senhaNova, setSenhaNova] = useState<TeacherComSenha | null>(null);
  const [gerandoAcesso, setGerandoAcesso] = useState(false);
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

  // A senha existe em texto claro só nesta resposta: a tela para aqui até
  // alguém dizer que já copiou. Navegar sozinho perderia a senha.
  if (senhaNova) {
    return (
      <SenhaTemporariaCard
        titulo="Acesso do professor gerado"
        papel="professor"
        nomeAluno={senhaNova.nome}
        senha={senhaNova.senhaTemporaria}
        telefone={senhaNova.telefone}
        onConcluir={() => {
          setSenhaNova(null);
          void getTeacher(id).then(setTeacher);
        }}
        concluirLabel="Voltar para a ficha"
      />
    );
  }

  async function handleGerarAcesso() {
    setError(null);
    setGerandoAcesso(true);
    try {
      setSenhaNova(await gerarAcessoProfessor(id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível gerar o acesso.",
      );
    } finally {
      setGerandoAcesso(false);
    }
  }

  return (
    <FormCard
      title="Editar professor"
      description={<StatusBadge ativo={teacher.status === "ativo"} />}
    >
      {/*
        SPEC-018/TASK-004 — a foto vem antes dos campos porque é a
        identificação da ficha, não mais um dado dela. E fica FORA do
        `form`: ela sobe sozinha, na hora, e não tem nada a ver com o
        "Salvar" dos campos de texto — dentro do form, o botão de escolher
        arquivo herdaria o `submit` e o Enter salvaria a ficha inteira.
      */}
      <FotoDoProfessor
        professorId={id}
        fotoInicial={teacher.fotoUrl}
        temConta={Boolean(teacher.usuarioId)}
      />

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

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={gerandoAcesso || !teacher.email}
          onClick={() => void handleGerarAcesso()}
          className="h-11 gap-2 border-[1.5px] border-primary px-6 text-[13px] font-semibold text-primary hover:bg-primary/5"
        >
          <KeyRound className="size-4" />
          {gerandoAcesso
            ? "Gerando..."
            : teacher.usuarioId
              ? "Gerar nova senha temporária"
              : "Gerar acesso do professor"}
        </Button>
        <p className="text-xs text-[var(--color-on-surface-variant)]">
          {!teacher.email
            ? "Preencha o e-mail acima e salve: ele é o login do professor."
            : teacher.usuarioId
              ? "O professor já tem acesso. Gerar outra senha invalida a anterior e encerra as sessões abertas."
              : "Cria a conta do professor com uma senha temporária de 7 dias. Ele troca a senha no primeiro acesso e enxerga apenas as próprias turmas."}
        </p>
      </div>

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
