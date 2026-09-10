"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiError,
  getStudent,
  updateStudent,
  type Student,
  type UpdateStudentDto,
} from "@/lib/api-client";

/**
 * SPEC-036/TASK-004 — **os campos que faltavam na ficha do aluno.**
 *
 * ## Por que um componente próprio, e não sete campos no formulário existente
 *
 * O `edit-student-form` já faz duas coisas (dados + senha temporária) em 187
 * linhas. Sete campos a mais o tornariam a tela mais longa do painel, e o
 * botão "Salvar" passaria a governar dois assuntos que a pessoa edita em
 * momentos diferentes: nome e nível se corrigem no cadastro; contato de
 * emergência e endereço se preenchem quando o aluno traz o dado.
 *
 * É o mesmo arranjo da carteira e da frequência — **seções na ficha**, cada
 * uma dona do próprio salvar.
 *
 * ## A barra mostra o que FALTA, não só o número
 *
 * `70%` não diz a ninguém o que fazer. A lista dos campos ausentes diz — e é a
 * mesma decisão que a SPEC-035 tomou do outro lado, quando a recusa da
 * reativação passou a trazer a contagem dos conflitos.
 *
 * **Nada aqui bloqueia nada** (SPEC-036/D4). A barra é incentivo; o aluno com
 * 29% reserva quadra igual, e há um gate no `back` que fica vermelho se
 * alguém transformar este número em requisito sem decidir isso antes.
 */
/**
 * As 27, **e o tipo vem do CONTRATO, não desta lista.**
 *
 * `UpdateStudentDto["uf"]` é a união gerada do `openapi.json`: se o back
 * acrescentar ou tirar uma sigla, o `tsc` daqui quebra. Uma lista solta com
 * tipo `string[]` deixaria o typecheck verde e a tela oferecendo uma sigla que
 * o servidor recusa — que é o DEF-012 em miniatura.
 */
type UF = NonNullable<UpdateStudentDto["uf"]>;

const UFS: UF[] = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const SEM_UF = "sem-uf";

/** O rótulo de cada campo que pode faltar, na língua de quem lê a tela. */
const ROTULO: Record<string, string> = {
  nome: "nome",
  email: "e-mail",
  telefone: "telefone",
  dataNascimento: "data de nascimento",
  emergenciaNome: "contato de emergência",
  emergenciaTelefone: "telefone de emergência",
  nivelId: "nível",
};

/** `null` apaga; `""` o servidor recusa com 400 (INV-108). */
function ouNulo(valor: string): string | null {
  return valor.trim() === "" ? null : valor;
}

export function CadastroCompletoDoAluno({ alunoId }: { alunoId: string }) {
  const [aluno, setAluno] = useState<Student | null>(null);
  const [dataNascimento, setDataNascimento] = useState("");
  const [emergenciaNome, setEmergenciaNome] = useState("");
  const [emergenciaTelefone, setEmergenciaTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState<UF | typeof SEM_UF>(SEM_UF);
  const [observacoesSaude, setObservacoesSaude] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function aplicar(dados: Student) {
    setAluno(dados);
    setDataNascimento(dados.dataNascimento ?? "");
    setEmergenciaNome(dados.emergenciaNome ?? "");
    setEmergenciaTelefone(dados.emergenciaTelefone ?? "");
    setEndereco(dados.endereco ?? "");
    setCidade(dados.cidade ?? "");
    setUf((dados.uf as UF | null) ?? SEM_UF);
    setObservacoesSaude(dados.observacoesSaude ?? "");
  }

  useEffect(() => {
    let vivo = true;
    getStudent(alunoId)
      .then((dados) => {
        if (vivo) aplicar(dados);
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar o cadastro.");
      });
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvo(false);
    setSalvando(true);
    try {
      const atualizado = await updateStudent(alunoId, {
        dataNascimento: ouNulo(dataNascimento),
        emergenciaNome: ouNulo(emergenciaNome),
        emergenciaTelefone: ouNulo(emergenciaTelefone),
        endereco: ouNulo(endereco),
        cidade: ouNulo(cidade),
        uf: uf === SEM_UF ? null : uf,
        observacoesSaude: ouNulo(observacoesSaude),
      });
      aplicar(atualizado);
      setSalvo(true);
    } catch (e) {
      // Pelo `code` quando existe — a mesma regra do D7 da SPEC-033.
      const code = e instanceof ApiError ? e.code : undefined;
      setErro(
        code === "DATA_NASCIMENTO_INVALIDA"
          ? "A data de nascimento precisa ser posterior a 1900 e não pode estar no futuro."
          : e instanceof ApiError
            ? e.message
            : "Não foi possível salvar o cadastro.",
      );
    } finally {
      setSalvando(false);
    }
  }

  /** A idade, só para conferência de quem digita. Não muda regra nenhuma. */
  const idade = (() => {
    if (!dataNascimento) return null;
    const [ano, mes, dia] = dataNascimento.split("-").map(Number);
    if (!ano || !mes || !dia) return null;
    // `Date.UTC` com as partes explícitas: `new Date(iso)` já virou o dia
    // anterior neste projeto mais de uma vez (DEF-020).
    const nasc = new Date(Date.UTC(ano, mes - 1, dia));
    const hoje = new Date();
    let anos = hoje.getUTCFullYear() - nasc.getUTCFullYear();
    const mesDiff = hoje.getUTCMonth() - nasc.getUTCMonth();
    if (
      mesDiff < 0 ||
      (mesDiff === 0 && hoje.getUTCDate() < nasc.getUTCDate())
    ) {
      anos -= 1;
    }
    return anos;
  })();

  const cadastro = aluno?.cadastro;

  return (
    <FormCard
      title="Cadastro completo"
      description="Contato de emergência, nascimento e endereço. Nada aqui bloqueia o aluno de reservar."
    >
      {cadastro ? (
        <div className="flex flex-col gap-2 pb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">
              {cadastro.percentual}% preenchido
            </span>
            {cadastro.faltam.length > 0 ? (
              <span className="text-xs text-[var(--color-on-surface-variant)]">
                {/* O número sozinho não diz o que fazer. A lista diz. */}
                falta: {cadastro.faltam.map((c) => ROTULO[c] ?? c).join(", ")}
              </span>
            ) : (
              <span className="text-xs font-medium text-[var(--color-primary)]">
                cadastro completo
              </span>
            )}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-container-high)]"
            role="progressbar"
            aria-valuenow={cadastro.percentual}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Completude do cadastro"
          >
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${cadastro.percentual}%` }}
            />
          </div>
        </div>
      ) : null}

      <form onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cad-nascimento">Data de nascimento</Label>
          <Input
            id="cad-nascimento"
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            disabled={salvando}
            className="h-10 px-3"
          />
          {idade !== null ? (
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              {/* Informação, e só: menor de idade não muda regra nenhuma
                  nesta versão (LIM-036c). */}
              {idade} anos.
            </p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="cad-emerg-nome">Contato de emergência</Label>
            <Input
              id="cad-emerg-nome"
              value={emergenciaNome}
              onChange={(e) => setEmergenciaNome(e.target.value)}
              disabled={salvando}
              placeholder="Nome de quem avisar"
              className="h-10 px-3"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="cad-emerg-tel">Telefone de emergência</Label>
            <Input
              id="cad-emerg-tel"
              value={emergenciaTelefone}
              onChange={(e) => setEmergenciaTelefone(e.target.value)}
              disabled={salvando}
              className="h-10 px-3"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cad-endereco">Endereço</Label>
          <Input
            id="cad-endereco"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            disabled={salvando}
            className="h-10 px-3"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="cad-cidade">Cidade</Label>
            <Input
              id="cad-cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              disabled={salvando}
              className="h-10 px-3"
            />
          </div>
          <div className="flex w-28 flex-col gap-2">
            <Label htmlFor="cad-uf">UF</Label>
            <Select
              value={uf}
              onValueChange={(v) => setUf(v as UF | typeof SEM_UF)}
              disabled={salvando}
            >
              <SelectTrigger id="cad-uf" className="h-10 w-full px-3">
                <SelectValue placeholder="--" />
              </SelectTrigger>
              <SelectContent>
                {/* `SEM_UF` e não `""`: o `Select` do Radix trata string
                    vazia como "sem valor" e some com o placeholder. */}
                <SelectItem value={SEM_UF}>--</SelectItem>
                {UFS.map((sigla) => (
                  <SelectItem key={sigla} value={sigla}>
                    {sigla}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cad-saude">Observações de saúde</Label>
          <Input
            id="cad-saude"
            value={observacoesSaude}
            onChange={(e) => setObservacoesSaude(e.target.value)}
            disabled={salvando}
            placeholder="Alergia, lesão, medicação"
            className="h-10 px-3"
          />
        </div>

        {erro ? (
          <p
            role="alert"
            className="text-sm font-semibold text-[var(--color-error)]"
          >
            {erro}
          </p>
        ) : null}
        {salvo ? (
          <p
            role="status"
            className="text-sm font-semibold text-[var(--color-primary)]"
          >
            Cadastro salvo.
          </p>
        ) : null}

        <div className="flex justify-end border-t border-border pt-4">
          <Button
            type="submit"
            disabled={salvando}
            className="h-11 px-6 text-[13px] font-semibold"
          >
            {salvando ? "Salvando..." : "Salvar cadastro"}
          </Button>
        </div>
      </form>
    </FormCard>
  );
}
