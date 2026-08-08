"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    return <p className="text-[var(--color-text-secondary)]">Carregando...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{court.nome}</CardTitle>
            <Badge variant={court.status === "ativa" ? "default" : "secondary"}>
              {court.status === "ativa" ? "Ativa" : "Inativa"}
            </Badge>
          </div>
          <CardDescription>Editar dados da quadra</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSaveCourt} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} disabled={editLoading} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esporte">Esporte</Label>
              <Input
                id="esporte"
                required
                value={esporte}
                onChange={(e) => setEsporte(e.target.value)}
                disabled={editLoading}
              />
            </div>
            <div className="flex flex-col gap-2">
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
            variant={court.status === "ativa" ? "destructive" : "outline"}
            disabled={statusLoading}
            onClick={() => void handleToggleStatus()}
          >
            {statusLoading ? "Aplicando..." : court.status === "ativa" ? "Inativar quadra" : "Reativar quadra"}
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Disponibilidade</CardTitle>
          <CardDescription>Grade do dia — clique num horário livre para reservar</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <Button type="button" onClick={() => void loadAvailability()} disabled={availLoading}>
              {availLoading ? "Carregando..." : "Ver disponibilidade"}
            </Button>
          </div>

          {availError ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {availError}
            </p>
          ) : null}

          {availability ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availability.slots.map((slot) => (
                <button
                  key={slot.slot}
                  type="button"
                  disabled={slot.status !== "livre"}
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-[var(--radius)] border px-3 py-2 text-sm ${
                    slot.status === "livre"
                      ? "border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
                      : "cursor-not-allowed border-border bg-muted text-[var(--color-text-secondary)]"
                  } ${selectedSlot?.slot === slot.slot ? "bg-[var(--color-primary)] text-white" : ""}`}
                >
                  {slot.slot}
                  <br />
                  <span className="text-xs">
                    {slot.status === "livre" ? "Livre" : slot.status === "ocupado_turma" ? "Turma" : "Reservado"}
                  </span>
                  {slot.status === "ocupado_avulso"
                    ? (() => {
                        const [horaInicioSlot] = slot.slot.split("-");
                        const booking = bookingsDoDia.find((b) => b.horaInicio === horaInicioSlot);
                        return (
                          <span className="mt-1 flex flex-col items-center gap-0.5">
                            <span className="text-[0.65rem]">
                              {booking?.statusPagamento === "pago" ? "Pago" : "Pendente"}
                            </span>
                            {booking?.statusPagamento === "pendente_pagamento" ? (
                              <span
                                role="button"
                                className="block underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkPaid(slot);
                                }}
                              >
                                {markingPaidId === booking.id ? "Marcando..." : "Marcar pago"}
                              </span>
                            ) : null}
                            <span
                              role="button"
                              className="block underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCancelSlot(slot);
                              }}
                            >
                              {cancelingId === booking?.id ? "Cancelando..." : "Cancelar"}
                            </span>
                          </span>
                        );
                      })()
                    : null}
                </button>
              ))}
            </div>
          ) : null}

          {selectedSlot ? (
            <form onSubmit={handleCreateBooking} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
              <p className="text-sm font-medium text-foreground">Reservar {selectedSlot.slot}</p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="aluno">Aluno</Label>
                <Select value={alunoId} onValueChange={setAlunoId} disabled={bookingLoading}>
                  <SelectTrigger id="aluno">
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
              <Button type="submit" disabled={bookingLoading || !alunoId}>
                {bookingLoading ? "Reservando..." : "Confirmar reserva"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
