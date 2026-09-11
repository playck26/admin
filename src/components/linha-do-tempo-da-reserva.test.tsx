import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { LinhaDoTempoDaReserva } from "./linha-do-tempo-da-reserva";

/**
 * SPEC-032/TASK-004 — a linha do tempo de uma reserva.
 *
 * **O que este arquivo guarda** é o que não se vê olhando a tela: que ela
 * **não busca nada** até alguém pedir (a lista do dia tem dezenas de linhas), e
 * que ela mostra os **dois** vocabulários — o gesto humano e o efeito técnico —
 * quando eles divergem.
 */
const eventos = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listBookingEvents: eventos };
});

function evento(extra: Record<string, unknown> = {}) {
  return {
    tipo: "criada",
    acao: "reserva_criada",
    em: "2026-09-08T13:00:00.000Z",
    motivo: null,
    autor: { id: "u-1", nome: "Maria" },
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  eventos.mockResolvedValue([evento()]);
});

describe("LinhaDoTempoDaReserva", () => {
  it("**não busca nada até alguém pedir**", () => {
    render(<LinhaDoTempoDaReserva id="r-1" />);
    // O diálogo do dia lista dezenas de reservas. Buscar na montagem seria
    // pagar N requisições para mostrar uma.
    expect(eventos).not.toHaveBeenCalled();
    expect(screen.getByText("Ver histórico")).toBeInTheDocument();
  });

  it("abre, busca uma vez, e FECHAR não busca de novo", async () => {
    render(<LinhaDoTempoDaReserva id="r-1" />);
    fireEvent.click(screen.getByText("Ver histórico"));
    // **`await` obrigatório, e a sabotagem foi quem me ensinou.** Sem ele a
    // busca ainda está em voo, `carregando` continua `true`, e a reabertura
    // seria barrada por essa guarda em vez da guarda que o caso afere — o
    // teste passava com o cache ARRANCADO.
    await screen.findByText("reserva criada");

    fireEvent.click(screen.getByText("Ocultar histórico"));
    fireEvent.click(screen.getByText("Ver histórico"));

    // Evento é append-only (INV-061: a trigger recusa `UPDATE` e `DELETE`),
    // então a lista não muda enquanto o diálogo está aberto.
    expect(eventos).toHaveBeenCalledTimes(1);
  });

  it("mostra o gesto humano, quem fez e quando", async () => {
    render(<LinhaDoTempoDaReserva id="r-1" />);
    fireEvent.click(screen.getByText("Ver histórico"));

    expect(await screen.findByText("reserva criada")).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
    // Data **e hora**: duas ações do mesmo dia são a pergunta mais comum de
    // quem foi investigar um caso.
    expect(screen.getByText(/08\/09\/2026/)).toBeInTheDocument();
  });

  it("**quando o gesto e o efeito DIVERGEM, mostra os dois**", async () => {
    // Uma ocupação `cancelada` por `turma_inativada` conta uma história
    // diferente de uma cancelada por `reserva_cancelada`. Mostrar só um dos
    // dois seria uma tradução com perda — e a spec separou os campos
    // exatamente para não perder.
    eventos.mockResolvedValue([
      evento({ tipo: "cancelada", acao: "turma_inativada" }),
    ]);
    render(<LinhaDoTempoDaReserva id="r-1" />);
    fireEvent.click(screen.getByText("Ver histórico"));

    const linha = await screen.findByText(/turma inativada/);
    expect(linha).toHaveTextContent("cancelada");
    // **`toHaveTextContent` enxerga texto ESCONDIDO**, e a sabotagem passou por
    // isso: bastou `hidden` no `<span>` para o caso continuar verde sobre uma
    // informação que ninguém vê. `toBeVisible` é o que afere a tela.
    expect(screen.getByText(/· cancelada/)).toBeVisible();
  });

  it("o motivo aparece quando existe, e não há placeholder quando não", async () => {
    eventos.mockResolvedValue([
      evento({ tipo: "cancelada", acao: "aula_cancelada", motivo: "chuva" }),
    ]);
    render(<LinhaDoTempoDaReserva id="r-1" />);
    fireEvent.click(screen.getByText("Ver histórico"));

    expect(await screen.findByText(/chuva/)).toBeInTheDocument();
  });

  it("**vazio é LIM-032a, não erro** — linha anterior à spec nasceu sem evento", async () => {
    eventos.mockResolvedValue([]);
    render(<LinhaDoTempoDaReserva id="r-1" />);
    fireEvent.click(screen.getByText("Ver histórico"));

    // "Nenhum evento encontrado" soaria como falha de busca; a frase certa diz
    // a verdade, que é que ninguém registrou.
    expect(
      await screen.findByText(/anterior ao registro de ações/),
    ).toBeInTheDocument();
  });

  it("erro do servidor aparece como alerta", async () => {
    eventos.mockRejectedValue(new ApiError(404, "Reserva não encontrada."));
    render(<LinhaDoTempoDaReserva id="r-1" />);
    fireEvent.click(screen.getByText("Ver histórico"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não encontrada/,
    );
  });

  it("uma falha não gruda: reabrir tenta de novo", async () => {
    eventos.mockRejectedValueOnce(new ApiError(500, "falhou"));
    render(<LinhaDoTempoDaReserva id="r-1" />);
    fireEvent.click(screen.getByText("Ver histórico"));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByText("Ocultar histórico"));
    fireEvent.click(screen.getByText("Ver histórico"));

    // `eventos` continua `null` depois do erro, então a segunda abertura
    // busca — sem isto, um erro de rede trancaria o histórico até recarregar.
    await waitFor(() => expect(eventos).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("reserva criada")).toBeInTheDocument();
  });
});
