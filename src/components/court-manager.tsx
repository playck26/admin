"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  cancelBooking,
  createBooking,
  getAvailability,
  getCourt,
  listBookings,
  listStudents,
  updateBookingPaymentStatus,
  updateCourt,
  type Availability,
  type AvailabilitySlot,
  type Booking,
  type Court,
  type Student,
} from "@/lib/api-client";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CourtManager({ id }: { id: string }) {
  const [court, setCourt] = useState<Court | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [esporte, setEsporte] = useState("");
  const [precoHora, setPrecoHora] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [data, setData] = useState(todayIso());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [bookingsDoDia, setBookingsDoDia] = useState<Booking[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [alunoId, setAlunoId] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCourt(id), listStudents(1, 100)])
      .then(([courtData, studentsData]) => {
        setCourt(courtData);
        setNome(courtData.nome);
        setEsporte(courtData.esporte);
        setPrecoHora(String(courtData.precoHora));
        setStudents(studentsData.data);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a quadra.");
      });
  }, [id]);

  async function loadAvailability() {
    setAvailLoading(true);
    setAvailError(null);
    setSelectedSlot(null);
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
      const updated = await updateCourt(id, { nome, esporte, precoHora: Number(precoHora) });
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
    if (!selectedSlot) return;
    setBookingError(null);
    setBookingLoading(true);
    try {
      const [horaInicio, horaFim] = selectedSlot.slot.split("-");
      await createBooking({ quadraId: id, data, horaInicio, horaFim, alunoId });
      setSelectedSlot(null);
      setAlunoId("");
      await loadAvailability();
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : "Não foi possível criar a reserva.");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleCancelSlot(slot: AvailabilitySlot) {
    const [horaInicio] = slot.slot.split("-");
    const booking = bookingsDoDia.find((b) => b.horaInicio === horaInicio);
    if (!booking) return;

    setCancelingId(booking.id);
    setAvailError(null);
    try {
      await cancelBooking(booking.id);
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
    const booking = bookingsDoDia.find((b) => b.horaInicio === horaInicio);
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="esporte">Esporte</Label>
              <Input
                id="esporte"
                required
                value={esporte}
                onChange={(e) => setEsporte(e.target.value)}
                disabled={editLoading}
                className="h-10 px-3"
              />
            </div>
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

          {availability ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {availability.slots.map((slot) => {
                if (slot.status === "livre") {
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`group flex flex-col gap-2 rounded-lg border-[1.5px] p-3 text-left transition-colors ${
                        selectedSlot?.slot === slot.slot
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
                const booking = bookingsDoDia.find((b) => b.horaInicio === horaInicioSlot);
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

          {selectedSlot ? (
            <form onSubmit={handleCreateBooking} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-[var(--color-on-surface)]">Reservar {selectedSlot.slot}</p>
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
              </div>
              {bookingError ? (
                <p role="alert" className="text-sm text-[var(--color-error)]">
                  {bookingError}
                </p>
              ) : null}
              <Button type="submit" disabled={bookingLoading || !alunoId} className="h-10 text-[13px] font-semibold">
                {bookingLoading ? "Reservando..." : "Confirmar reserva"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
