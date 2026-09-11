"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HorarioQuadraSection } from "@/components/horario-quadra-section";
import { ImagemDaQuadraSection } from "@/components/imagem-da-quadra-section";
import { SeletorDeCatalogo } from "@/components/seletor-de-catalogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import {
  getExtratoDeCredito,
  ApiError,
  cancelBooking,
  createBooking,
  getAvailability,
  getCourt,
  listBookings,
  listStudents,
  listTeachers,
  updateBookingPaymentStatus,
  updateCourt,
  type Availability,
  type AvailabilitySlot,
  type Booking,
  type Court,
  type Student,
  type Teacher,
} from "@/lib/api-client";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * O valor do item "sem professor" no seletor.
 *
 * **Não pode ser `""`**: o `Select` do Radix usa string vazia para limpar a
 * seleção e recusa um `SelectItem` com esse valor. O estado do formulário
 * continua guardando `""` para "sem professor"; a tradução acontece nas duas
 * pontas do seletor.
 */
const SEM_PROFESSOR = "__sem_professor__";

const emReaisDoSaldo = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function CourtManager({ id }: { id: string }) {
  const [court, setCourt] = useState<Court | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  // SPEC-020/TASK-005 — eram texto livre. Agora são ids de catálogo.
  const [esporteId, setEsporteId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [precoHora, setPrecoHora] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  /**
   * SPEC-039 — a aula particular.
   *
   * `professorId` vazio significa **reserva de quadra**, que é o caso comum e
   * o padrão da tela. Escolher um professor é o gesto que transforma o pedido
   * em aula, e é ele que revela o campo de preço.
   */
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [professorId, setProfessorId] = useState("");
  const [valorAula, setValorAula] = useState("");
  const [data, setData] = useState(todayIso());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [bookingsDoDia, setBookingsDoDia] = useState<Booking[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  // SPEC-011: seleção múltipla, guardando os rótulos — a grade recarrega
  // depois de cada reserva e os objetos deixam de ser os mesmos.
  const [slotsSelecionados, setSlotsSelecionados] = useState<string[]>([]);
  const [alunoId, setAlunoId] = useState("");
  /**
   * SPEC-048/AC-006 — o saldo do aluno escolhido.
   *
   * **Guarda DE QUEM é o saldo, não só o número.** A primeira versão zerava o
   * estado ao trocar de aluno, e o lint recusou: `setState` síncrono dentro de
   * efeito dispara render em cascata. O conserto certo não era silenciar a
   * regra — era parar de precisar zerar: com o dono junto, o saldo do aluno
   * anterior **não casa** e simplesmente não aparece.
   *
   * De quebra, mata a corrida: duas buscas voltando fora de ordem não
   * conseguem pintar o saldo errado na pessoa errada.
   */
  const [saldo, setSaldo] = useState<{
    alunoId: string;
    centavos: number;
  } | null>(null);
  /**
   * Quanto voltou no último cancelamento. `null` é "nada a dizer" — e são
   * dois casos diferentes com a mesma resposta de tela: ninguém cancelou
   * ainda, e cancelou mas não havia crédito a devolver (reserva de turma,
   * reserva sem aluno). Prometer devolução que não houve faz o gestor
   * procurar um movimento que não existe.
   */
  const [creditoDevolvido, setCreditoDevolvido] = useState<number | null>(null);

  /**
   * A carteira do aluno escolhido. **Zera ao trocar de aluno** — sem isso o
   * saldo do anterior ficaria na tela durante a nova busca, e o gestor
   * decidiria por um número que já não é daquela pessoa.
   */
  useEffect(() => {
    if (!alunoId) return;
    let vivo = true;
    getExtratoDeCredito(alunoId)
      .then((e) => vivo && setSaldo({ alunoId, centavos: e.saldoCentavos }))
      // Falha aqui não impede reservar: some o aviso, não a ação.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  /** Só é o saldo desta pessoa se o dono casar. */
  const saldoCentavos = saldo?.alunoId === alunoId ? saldo.centavos : null;

  /**
   * SPEC-048/D6 — **quanto vai ser cobrado, em centavos, num lugar só.**
   *
   * Duas origens de preço, e a escolha é a mesma do servidor: com professor o
   * valor é o da AULA e **substitui** o da quadra (SPEC-047/D5, que herdou da
   * SPEC-039); sem professor é `precoHora × horas`. Repetir essa escolha em
   * dois lugares da tela seria duas chances de discordar do que o back grava.
   *
   * `Math.round` na fronteira reais→centavos: `1.1 * 100` é
   * `110.00000000000001` em ponto flutuante.
   */
  const cobrancaCentavos = professorId
    ? Math.round(Number(valorAula || 0) * 100)
    : Math.round(
        slotsSelecionados.length * Number(court?.precoHora ?? 0) * 100,
      );
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCourt(id), listStudents(1, 100), listTeachers(1, 100)])
      .then(([courtData, studentsData, teachersData]) => {
        setCourt(courtData);
        setNome(courtData.nome);
        // `?? ""` porque `esporte` pode vir nulo: quadra cujo texto
        // estava em branco quando o backfill rodou. O seletor abre sem
        // escolha, e o gestor resolve escolhendo — que é o que a TASK-004
        // vai passar a exigir.
        setEsporteId(courtData.esporte?.id ?? "");
        setCategoriaId(courtData.categoria?.id ?? "");
        setPrecoHora(String(courtData.precoHora));
        setStudents(studentsData.data);
        // SPEC-039: só os ATIVOS entram no seletor. O servidor recusa o
        // inativo com `422 PROFESSOR_INATIVO`, e oferecer na lista quem vai
        // ser recusado é fazer o gestor descobrir por erro.
        setTeachers(teachersData.data.filter((t) => t.status === "ativo"));
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a quadra.");
      });
  }, [id]);

  async function loadAvailability() {
    setAvailLoading(true);
    setAvailError(null);
    setSlotsSelecionados([]);
    try {
      const [availData, bookingsData] = await Promise.all([
        getAvailability(id, data),
        listBookings({ data, status: undefined }),
      ]);
      setAvailability(availData);
      setBookingsDoDia(bookingsData.data.filter((b) => b.quadraId === id && b.statusPagamento !== "cancelado"));
    } catch (err) {
      setAvailError(err instanceof ApiError ? err.message : "Não foi possível carregar a disponibilidade.");
    } finally {
      setAvailLoading(false);
    }
  }

  async function handleSaveCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);
    setEditLoading(true);
    try {
      const updated = await updateCourt(id, {
        nome,
        esporteId,
        // `null` explícito LIMPA a categoria; ausente não mexe. É o que
        // permite desclassificar uma quadra classificada por engano.
        categoriaId: categoriaId === "" ? null : categoriaId,
        precoHora: Number(precoHora),
      });
      setCourt(updated);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleToggleStatus() {
    if (!court) return;
    setStatusLoading(true);
    try {
      const updated = await updateCourt(id, { status: court.status === "ativa" ? "inativa" : "ativa" });
      setCourt(updated);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Não foi possível mudar o status.");
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleCreateBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (slotsSelecionados.length === 0) return;
    setBookingError(null);
    setBookingLoading(true);
    try {
      await createBooking({
        quadraId: id,
        data,
        slots: slotsSelecionados.map((rotulo) => {
          const [horaInicio, horaFim] = rotulo.split("-");
          return { horaInicio, horaFim };
        }),
        alunoId,
        // SPEC-039: os dois viajam juntos ou nenhum viaja. `undefined` e não
        // string vazia — `""` chegaria como UUID inválido no DTO.
        professorId: professorId || undefined,
        valor: professorId ? Number(valorAula) : undefined,
      });
      setSlotsSelecionados([]);
      setAlunoId("");
      setProfessorId("");
      setValorAula("");
      await loadAvailability();
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : "Não foi possível criar a reserva.");
    } finally {
      setBookingLoading(false);
    }
  }

  /**
   * A reserva que **cobre** este slot — por INTERVALO, não por igualdade.
   *
   * **O `find` era `b.horaInicio === horaInicio`, e isso era defeito.** O
   * servidor agrupa horários contíguos numa reserva só (SPEC-011/AC-001):
   * escolher 19–20 e 20–21 grava UMA ocupação 19:00–21:00. A grade, porém,
   * desenha slots de 1 hora — então o slot das 20h não casava com reserva
   * nenhuma, e `undefined` caía no ramo "pendente".
   *
   * O resultado era o pior possível numa tela de dinheiro: a reserva de 2h
   * paga com o crédito do aluno mostrava **"Pendente" e "Marcar pago"** na
   * segunda hora, convidando o clube a cobrar de novo o que a carteira acabou
   * de quitar. E os dois botões eram no-op silencioso, porque
   * `handleCancelSlot` e `handleMarkPaid` repetiam o mesmo `find` e
   * devolviam sem mensagem.
   *
   * Achado pela revisão adversarial da `cliente#14`, que procurou a mesma
   * classe de defeito em outras telas — e encontrou.
   */
  function reservaDoSlot(horaInicio: string) {
    return bookingsDoDia.find(
      (b) => b.horaInicio <= horaInicio && b.horaFim > horaInicio,
    );
  }

  async function handleCancelSlot(slot: AvailabilitySlot) {
    const [horaInicio] = slot.slot.split("-");
    const booking = reservaDoSlot(horaInicio);
    if (!booking) return;

    setCancelingId(booking.id);
    setAvailError(null);
    setCreditoDevolvido(null);
    try {
      // SPEC-048/AC-011 — **a resposta era descartada.** O crédito voltava
      // para a carteira do aluno e o gestor não via; só descobriria abrindo a
      // ficha. Cancelar é o gesto que mais move dinheiro nesta tela.
      const { creditoDevolvidoCentavos } = await cancelBooking(booking.id);
      setCreditoDevolvido(creditoDevolvidoCentavos);
      await loadAvailability();
    } catch (err) {
      setAvailError(err instanceof ApiError ? err.message : "Não foi possível cancelar a reserva.");
    } finally {
      setCancelingId(null);
    }
  }

  // REQ-003 (SPEC-006): admin marca reserva avulsa como paga.
  async function handleMarkPaid(slot: AvailabilitySlot) {
    const [horaInicio] = slot.slot.split("-");
    const booking = reservaDoSlot(horaInicio);
    if (!booking) return;

    setMarkingPaidId(booking.id);
    setAvailError(null);
    try {
      await updateBookingPaymentStatus(booking.id, "pago");
      await loadAvailability();
    } catch (err) {
      setAvailError(err instanceof ApiError ? err.message : "Não foi possível marcar como pago.");
    } finally {
      setMarkingPaidId(null);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-[var(--color-error)]">
        {loadError}
      </p>
    );
  }

  if (!court) {
    return <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>;
  }

  // REQ-006 (SPEC-008): resolve o nome do aluno no slot "ocupado_avulso"
  // contra a lista de students já carregada — dado que já existe, só não
  // estava exposto na UI.
  const studentsById = new Map(students.map((student) => [student.id, student.nome]));

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2 flex items-center gap-4">
        <Link
          href="/quadras"
          className="-ml-2 rounded-full p-2 text-[var(--color-on-surface-variant)] transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-[var(--color-on-surface)]">
          Gerenciar Quadra
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">Editar dados da quadra</h2>
            <StatusBadge ativo={court.status === "ativa"} activeLabel="Ativa" inactiveLabel="Inativa" />
          </div>

          <form onSubmit={handleSaveCourt} className="flex flex-col gap-4" noValidate>
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
            <SeletorDeCatalogo
              catalogo="court-sports"
              id="esporte"
              rotulo="Esporte"
              valor={esporteId}
              onChange={setEsporteId}
              obrigatorio
              desabilitado={editLoading}
            />
            <SeletorDeCatalogo
              catalogo="court-categories"
              id="categoria"
              rotulo="Categoria de piso (opcional)"
              valor={categoriaId}
              onChange={setCategoriaId}
              desabilitado={editLoading}
              opcaoVazia="Sem categoria"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="precoHora">Preço por hora (R$)</Label>
              <Input
                id="precoHora"
                type="number"
                min="0"
                step="0.01"
                required
                value={precoHora}
                onChange={(e) => setPrecoHora(e.target.value)}
                disabled={editLoading}
                className="h-10 px-3"
              />
            </div>
            {editError ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {editError}
              </p>
            ) : null}
            <Button type="submit" disabled={editLoading} className="mt-1 h-10 text-[13px] font-semibold">
              {editLoading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>

          <hr className="border-border" />

          <Button
            type="button"
            variant="outline"
            disabled={statusLoading}
            onClick={() => void handleToggleStatus()}
            className={
              court.status === "ativa"
                ? "h-10 gap-2 border-[1.5px] border-[var(--color-error)] text-[13px] font-semibold text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
                : "h-10 gap-2 border-[1.5px] border-primary text-[13px] font-semibold text-primary hover:bg-primary/5"
            }
          >
            <Ban className="size-4" />
            {statusLoading ? "Aplicando..." : court.status === "ativa" ? "Inativar quadra" : "Reativar quadra"}
          </Button>
        </div>

        <ImagemDaQuadraSection quadraId={id} imagemInicial={court.imagemUrl} />

        <HorarioQuadraSection quadraId={id} />

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">Disponibilidade</h2>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              Grade do dia — clique num horário livre para reservar
            </p>
          </div>

          <div className="flex items-end gap-3 border-b border-border pb-4">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-10 px-3" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadAvailability()}
              disabled={availLoading}
              className="h-10 shrink-0 border-[1.5px] border-primary px-5 text-[13px] font-semibold whitespace-nowrap text-primary hover:bg-primary/5"
            >
              {availLoading ? "Carregando..." : "Ver disponibilidade"}
            </Button>
          </div>

          {availError ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {availError}
            </p>
          ) : null}

          {/*
            SPEC-048/AC-011 — **só quando houve devolução de verdade.**

            O `> 0` cobre também o zero: reserva de turma e reserva sem aluno
            devolvem `null`, e uma devolução de zero centavos não é notícia.
            Dizer "R$ 0,00 voltou" faria o gestor procurar um movimento que não
            existe — é a mesma regra que a tela do aluno já segue.
          */}
          {creditoDevolvido !== null && creditoDevolvido > 0 ? (
            <p className="text-sm font-semibold text-[var(--color-success)]">
              {emReaisDoSaldo(creditoDevolvido)} voltaram para a carteira do
              aluno.
            </p>
          ) : null}

          {availability?.estado === "fechado" ? (
            /* SPEC-010/AC-008: sem este caso, dia fechado e dia lotado
               apareceriam como a mesma grade vazia. */
            <p className="rounded-lg bg-[var(--color-surface-variant)] p-4 text-[var(--color-on-surface-variant)]">
              Quadra fechada neste dia. Ajuste o horário de funcionamento em
              Configurações ou na própria quadra.
            </p>
          ) : availability ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {availability.slots.map((slot) => {
                if (slot.status === "livre") {
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      onClick={() =>
                        setSlotsSelecionados((atual) =>
                          atual.includes(slot.slot)
                            ? atual.filter((s) => s !== slot.slot)
                            : [...atual, slot.slot],
                        )
                      }
                      className={`group flex flex-col gap-2 rounded-lg border-[1.5px] p-3 text-left transition-colors ${
                        slotsSelecionados.includes(slot.slot)
                          ? "border-primary bg-primary/10"
                          : "border-primary hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">{slot.slot}</span>
                        <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary uppercase">
                          Livre
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100">
                        Clique para reservar
                      </p>
                    </button>
                  );
                }

                if (slot.status === "ocupado_turma") {
                  return (
                    <div
                      key={slot.slot}
                      className="flex flex-col gap-2 rounded-lg border border-[var(--color-surface-dim)] bg-[var(--color-surface-variant)] p-3 opacity-75"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">{slot.slot}</span>
                        <span className="rounded-lg bg-[var(--color-surface-dim)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-on-surface-variant)] uppercase">
                          Turma
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-on-surface-variant)]">Ocupado por turma fixa</span>
                    </div>
                  );
                }

                const [horaInicioSlot] = slot.slot.split("-");
                const booking = reservaDoSlot(horaInicioSlot);
                const alunoNome = booking?.alunoId ? studentsById.get(booking.alunoId) : undefined;
                return (
                  <div
                    key={slot.slot}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-[var(--color-surface-container-low)] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">{slot.slot}</span>
                      <span className="rounded-lg bg-[var(--color-surface-dim)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-on-surface-variant)] uppercase">
                        Reservado
                      </span>
                    </div>
                    <span className="truncate text-sm font-medium text-[var(--color-on-surface)]">
                      {alunoNome ?? "Aluno"}
                    </span>
                    {booking?.statusPagamento === "pago" ? (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          <CheckCircle2 className="size-3.5" /> Pago
                        </span>
                        <button
                          type="button"
                          className="text-xs text-[var(--color-error)] hover:underline"
                          onClick={() => void handleCancelSlot(slot)}
                        >
                          {cancelingId === booking?.id ? "Cancelando..." : "Cancelar"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-col gap-1">
                        <span className="w-max rounded bg-[var(--color-warning)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--color-warning)] uppercase">
                          Pendente
                        </span>
                        <div className="mt-1 flex items-center justify-between">
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => void handleMarkPaid(slot)}
                          >
                            {markingPaidId === booking?.id ? "Marcando..." : "Marcar pago"}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[var(--color-error)] hover:underline"
                            onClick={() => void handleCancelSlot(slot)}
                          >
                            {cancelingId === booking?.id ? "Cancelando..." : "Cancelar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {slotsSelecionados.length > 0 ? (
            <form onSubmit={handleCreateBooking} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--color-on-surface)]">
                  Reservar{" "}
                  {[...slotsSelecionados].sort().join(", ")}
                </p>
                {/*
                  SPEC-011/AC-003: o total aparece antes de confirmar. O
                  admin costuma reservar em nome do aluno e informar o
                  valor na hora — descobrir depois de confirmar significaria
                  corrigir por WhatsApp.
                */}
                {court ? (
                  <span className="text-sm font-semibold">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(slotsSelecionados.length * Number(court.precoHora))}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="aluno">Aluno</Label>
                <Select value={alunoId} onValueChange={setAlunoId} disabled={bookingLoading}>
                  <SelectTrigger id="aluno" className="h-10 w-full px-3">
                    <SelectValue placeholder="Selecione um aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/*
                  SPEC-048/REQ-002 — **o saldo do aluno, e o que VAI acontecer.**

                  O texto do campo de valor dizia "sai do saldo do aluno se
                  houver", e "se houver" é justamente o que o gestor não sabe.
                  Sem o número ele não distingue a reserva que nasce paga da
                  que nasce devendo — e as duas dão `201`.
                */}
                {saldoCentavos !== null ? (
                  <div className="rounded-xl bg-[var(--color-surface-variant)] px-4 py-3">
                    <p className="text-sm font-semibold">
                      Saldo do aluno: {emReaisDoSaldo(saldoCentavos)}
                    </p>
                    {cobrancaCentavos > 0 ? (
                      saldoCentavos >= cobrancaCentavos ? (
                        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                          Serão debitados {emReaisDoSaldo(cobrancaCentavos)} e a
                          reserva nasce <strong>paga</strong>.
                        </p>
                      ) : (
                        /*
                          AC-007/D3 — o gestor NÃO recebe `SALDO_INSUFICIENTE`:
                          para ele a reserva é criada assim mesmo, sem débito
                          (PA-04). A frase útil é o estado em que ela nasce.
                        */
                        <p className="mt-1 text-xs font-semibold text-[var(--color-warning)]">
                          O saldo não cobre os{" "}
                          {emReaisDoSaldo(cobrancaCentavos)}: a reserva será
                          criada <strong>pendente de pagamento</strong>, e nada
                          será debitado.
                        </p>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
              {/*
                SPEC-039 — a aula particular.

                **Um seletor, e não um interruptor "é aula?".** Escolher o
                professor já é a decisão; um passo a mais só existiria para
                repetir a mesma informação. "Sem professor" é a primeira
                opção porque reserva de quadra é o caso comum.
              */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="professor">Professor (aula particular)</Label>
                <Select
                  value={professorId || SEM_PROFESSOR}
                  onValueChange={(v) =>
                    setProfessorId(v === SEM_PROFESSOR ? "" : v)
                  }
                  disabled={bookingLoading}
                >
                  <SelectTrigger id="professor" className="h-10 w-full px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_PROFESSOR}>
                      Sem professor — reserva de quadra
                    </SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/*
                O preço só aparece com professor, e é obrigatório aí: na
                reserva de quadra ele vem da quadra, e o servidor recusa um
                valor sem professor (`422 VALOR_SEM_PROFESSOR`).
              */}
              {professorId ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="valor-aula">Valor da aula (R$)</Label>
                  <Input
                    id="valor-aula"
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorAula}
                    onChange={(e) => setValorAula(e.target.value)}
                    disabled={bookingLoading}
                    className="h-10 px-3"
                  />
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    O clube define o preço da aula. O total da quadra acima não
                    se aplica, e o valor sai do saldo do aluno se houver.
                  </p>
                </div>
              ) : null}

              {bookingError ? (
                <p role="alert" className="text-sm text-[var(--color-error)]">
                  {bookingError}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={
                  bookingLoading ||
                  !alunoId ||
                  // Com professor, o preço é obrigatório: mandar sem ele
                  // gravaria uma aula de R$ 0, que o `CHECK` aceita e ninguém
                  // quer. `>= 0` e não `> 0` — aula de cortesia existe.
                  (professorId !== "" &&
                    (valorAula === "" || Number(valorAula) < 0))
                }
                className="h-10 text-[13px] font-semibold"
              >
                {bookingLoading
                  ? "Reservando..."
                  : professorId
                    ? "Confirmar aula"
                    : "Confirmar reserva"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
