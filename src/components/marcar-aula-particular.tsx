"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createBooking,
  getDisponibilidadeDoProfessor,
  listCourts,
  listStudents,
  type Court,
  type DiaDeDisponibilidade,
  type Student,
} from "@/lib/api-client";
import { DIAS_SEMANA } from "@/lib/dias-semana";
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

/**
 * SPEC-039 — marcar aula particular **na ficha do professor**.
 *
 * ## Por que este componente existe, se a tela da quadra já marcava
 *
 * Porque ninguém achava lá. Na `court-manager` o seletor de professor vive
 * dentro do formulário de reserva, que só nasce **depois** de escolher a data,
 * clicar em "Ver disponibilidade" e selecionar um horário — três passos, e
 * nada na tela anuncia que dá para marcar aula ali.
 *
 * O Israel abriu o Admin procurando a funcionalidade e não encontrou. **Isso é
 * defeito de produto, não de uso:** feature que existe e não é alcançável é
 * feature que não existe.
 *
 * O caminho certo veio dele: *"escolho o professor, vejo quando ele atende,
 * marco"*. É a mesma razão pela qual a disponibilidade mora nesta ficha
 * (SPEC-040) e a carteira mora na ficha do aluno (SPEC-033) — quem marca aula
 * está olhando para uma **pessoa**.
 *
 * A entrada pela quadra continua valendo, e não é duplicação inútil: quem já
 * está olhando a grade de uma quadra não deveria ter de sair dela.
 *
 * ## A janela do professor guia, mas não decide
 *
 * O formulário mostra o que ele atende no dia escolhido e limita as horas
 * oferecidas. **Quem decide é o servidor** — a leitura aqui não desconta aulas
 * já marcadas (LIM-039e), então um horário oferecido ainda pode ser recusado
 * com `409 PROFESSOR_INDISPONIVEL`. Guiar reduz o erro; prometer seria mentir.
 */
const HORAS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`,
);

/** As mensagens por `code`, porque casar texto é o que o D7 recusou. */
const MENSAGEM: Record<string, string> = {
  FORA_DA_DISPONIBILIDADE:
    "Fora da janela de atendimento deste professor neste dia.",
  PROFESSOR_INDISPONIVEL:
    "O professor já tem compromisso neste horário — inclusive aula de turma.",
  PROFESSOR_INATIVO: "Este professor está inativo e não recebe aula.",
  SALDO_INSUFICIENTE:
    "O aluno não tem saldo para esta aula. Lance crédito na ficha dele, ou combine o pagamento por fora.",
};

export function MarcarAulaParticular({ professorId }: { professorId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [semana, setSemana] = useState<DiaDeDisponibilidade[] | null>(null);

  const [alunoId, setAlunoId] = useState("");
  const [quadraId, setQuadraId] = useState("");
  const [data, setData] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [valor, setValor] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      listStudents(1, 100),
      listCourts(1, 100),
      getDisponibilidadeDoProfessor(professorId),
    ])
      .then(([a, q, d]) => {
        if (!vivo) return;
        setStudents(a.data);
        // Quadra inativa não recebe aula nova — a mesma regra que a reserva já
        // segue, e oferecer aqui seria oferecer o que o servidor recusa.
        setCourts(q.data.filter((c) => c.status === "ativa"));
        setSemana(d);
      })
      .catch(() => vivo && setErro("Não foi possível carregar o formulário."));
    return () => {
      vivo = false;
    };
  }, [professorId]);

  /**
   * A janela do professor no dia escolhido.
   *
   * `data` é `YYYY-MM-DD` e o `Date` do JavaScript interpretaria como UTC ou
   * local dependendo do formato — por isso o dia da semana sai de
   * `Date.UTC(...)` com as partes explícitas, e não de `new Date(data)`. É a
   * mesma armadilha de fuso que a DEF-020 registrou no back.
   */
  const janela = (() => {
    if (!data || !semana) return null;
    const [ano, mes, dia] = data.split("-").map(Number);
    if (!ano || !mes || !dia) return null;
    const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    const linha = semana.find((d) => d.diaSemana === diaSemana);
    return {
      diaSemana,
      atende: linha != null && !linha.indisponivel,
      horaInicio: linha?.horaInicio ?? null,
      horaFim: linha?.horaFim ?? null,
    };
  })();

  /** Só as horas dentro da janela — guia, não garantia. */
  const horasOferecidas =
    janela?.atende && janela.horaInicio && janela.horaFim
      ? HORAS.filter((h) => h >= janela.horaInicio! && h <= janela.horaFim!)
      : HORAS;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSucesso(false);

    if (horaFim <= horaInicio) {
      setErro("O fim precisa ser depois do início.");
      return;
    }

    setEnviando(true);
    try {
      await createBooking({
        quadraId,
        data,
        slots: [{ horaInicio, horaFim }],
        alunoId,
        professorId,
        valor: Number(valor),
      });
      setSucesso(true);
      setHoraInicio("");
      setHoraFim("");
      setValor("");
    } catch (e) {
      // Pelo `code`, nunca pelo texto: o mesmo motivo do D7 da SPEC-033.
      const code = e instanceof ApiError ? e.code : undefined;
      setErro(
        (code ? MENSAGEM[code] : undefined) ??
          (e instanceof ApiError
            ? e.message
            : "Não foi possível marcar a aula."),
      );
    } finally {
      setEnviando(false);
    }
  }

  const podeEnviar =
    alunoId !== "" &&
    quadraId !== "" &&
    data !== "" &&
    horaInicio !== "" &&
    horaFim !== "" &&
    valor !== "" &&
    Number(valor) >= 0;

  return (
    <FormCard
      title="Marcar aula particular"
      description="A aula entra na linha do tempo da quadra e consome o saldo do aluno, se houver."
      className="max-w-2xl"
    >
      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="aula-aluno">Aluno</Label>
          <Select
            value={alunoId}
            onValueChange={setAlunoId}
            disabled={enviando}
          >
            <SelectTrigger id="aula-aluno" className="h-10 w-full px-3">
              <SelectValue placeholder="Selecione um aluno" />
            </SelectTrigger>
            <SelectContent>
              {students.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="aula-quadra">Quadra</Label>
          <Select
            value={quadraId}
            onValueChange={setQuadraId}
            disabled={enviando}
          >
            <SelectTrigger id="aula-quadra" className="h-10 w-full px-3">
              <SelectValue placeholder="Selecione uma quadra" />
            </SelectTrigger>
            <SelectContent>
              {courts.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="aula-data">Data</Label>
          <Input
            id="aula-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={enviando}
            className="h-10 px-3"
          />
          {/*
            O aviso da janela é o que faz esta tela valer mais que a da quadra:
            o gestor descobre ANTES de enviar que o professor não atende naquele
            dia, em vez de descobrir por `422`.
          */}
          {janela ? (
            <p
              className={`text-xs font-medium ${janela.atende ? "text-[var(--color-on-surface-variant)]" : "text-[var(--color-error)]"}`}
            >
              {janela.atende
                ? `Atende ${DIAS_SEMANA[janela.diaSemana].toLowerCase()} das ${janela.horaInicio} às ${janela.horaFim}.`
                : `Não atende ${DIAS_SEMANA[janela.diaSemana].toLowerCase()}. Configure a disponibilidade acima, ou escolha outro dia.`}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="aula-inicio">Início</Label>
            <Select
              value={horaInicio}
              onValueChange={setHoraInicio}
              disabled={enviando}
            >
              <SelectTrigger id="aula-inicio" className="h-10 w-full px-3">
                <SelectValue placeholder="--:--" />
              </SelectTrigger>
              <SelectContent>
                {horasOferecidas.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="aula-fim">Fim</Label>
            <Select
              value={horaFim}
              onValueChange={setHoraFim}
              disabled={enviando}
            >
              <SelectTrigger id="aula-fim" className="h-10 w-full px-3">
                <SelectValue placeholder="--:--" />
              </SelectTrigger>
              <SelectContent>
                {horasOferecidas.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="aula-valor">Valor da aula (R$)</Label>
          <Input
            id="aula-valor"
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={enviando}
            className="h-10 px-3"
          />
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            O clube define o preço da aula — não é o preço/hora da quadra.
          </p>
        </div>

        {erro ? (
          <p
            role="alert"
            className="text-sm font-semibold text-[var(--color-error)]"
          >
            {erro}
          </p>
        ) : null}
        {sucesso ? (
          <p
            role="status"
            className="text-sm font-semibold text-[var(--color-primary)]"
          >
            Aula marcada.
          </p>
        ) : null}

        <div className="flex justify-end border-t border-border pt-4">
          <Button
            type="submit"
            disabled={enviando || !podeEnviar}
            className="h-11 px-6 text-[13px] font-semibold"
          >
            {enviando ? "Marcando..." : "Marcar aula"}
          </Button>
        </div>
      </form>
    </FormCard>
  );
}
