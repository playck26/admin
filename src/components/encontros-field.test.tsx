import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EncontrosField,
  ENCONTRO_VAZIO,
  paraEnvio,
  type EncontroForm,
} from "./encontros-field";

/**
 * SPEC-019/TASK-004 — o editor da recorrência.
 *
 * É o componente que atende ao pedido que originou a spec: *"só consigo
 * adicionar a aula a um dia da semana"*. Ele é compartilhado por criar e
 * editar turma, então um defeito aqui aparece nos dois.
 */

const um = (): EncontroForm[] => [{ ...ENCONTRO_VAZIO }];

function montar(encontros: EncontroForm[] = um()) {
  const onChange = vi.fn();
  render(
    <EncontrosField encontros={encontros} onChange={onChange} disabled={false} />,
  );
  return onChange;
}

describe("EncontrosField", () => {
  it("mostra um encontro quando a turma tem um", () => {
    montar();
    expect(screen.getAllByLabelText("Dia")).toHaveLength(1);
  });

  it("mostra TRÊS quando a turma tem três", () => {
    montar([
      { diaSemana: "1", horaInicio: "07:00", horaFim: "08:00" },
      { diaSemana: "3", horaInicio: "18:00", horaFim: "19:30" },
      { diaSemana: "6", horaInicio: "09:00", horaFim: "10:00" },
    ]);
    expect(screen.getAllByLabelText("Dia")).toHaveLength(3);
  });

  it("acrescentar avisa com a lista INTEIRA, não só o novo", () => {
    // O componente é controlado: se ele mandasse só o item novo, o pai
    // perderia os anteriores a cada clique.
    const onChange = montar();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar encontro/i }));

    expect(onChange).toHaveBeenCalledWith([ENCONTRO_VAZIO, ENCONTRO_VAZIO]);
  });

  it("remover tira o encontro certo, não o último", () => {
    // Um `filter` errado (ou `pop()`) removeria o último em vez do clicado, e
    // o gestor veria sumir uma linha que não era a dele.
    const onChange = montar([
      { diaSemana: "1", horaInicio: "07:00", horaFim: "08:00" },
      { diaSemana: "3", horaInicio: "18:00", horaFim: "19:30" },
      { diaSemana: "6", horaInicio: "09:00", horaFim: "10:00" },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remover o encontro 2" }));

    expect(onChange).toHaveBeenCalledWith([
      { diaSemana: "1", horaInicio: "07:00", horaFim: "08:00" },
      { diaSemana: "6", horaInicio: "09:00", horaFim: "10:00" },
    ]);
  });

  it("alterar um campo não mexe nos outros encontros", () => {
    const onChange = montar([
      { diaSemana: "1", horaInicio: "07:00", horaFim: "08:00" },
      { diaSemana: "3", horaInicio: "18:00", horaFim: "19:30" },
    ]);

    fireEvent.change(screen.getAllByLabelText("Início")[1], {
      target: { value: "20:00" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { diaSemana: "1", horaInicio: "07:00", horaFim: "08:00" },
      { diaSemana: "3", horaInicio: "20:00", horaFim: "19:30" },
    ]);
  });

  describe("INV-051 — a turma precisa de pelo menos um encontro", () => {
    it("com UM encontro, o botão de remover fica desabilitado", () => {
      // O servidor recusa com `TURMA_SEM_ENCONTRO`, e recusa mesmo. Isto aqui
      // não substitui a garantia — evita que o gestor descubra a regra por
      // mensagem de erro depois de clicar.
      montar();
      expect(screen.getByRole("button", { name: "Remover o encontro 1" })).toBeDisabled();
    });

    it("com DOIS, volta a ficar habilitado", () => {
      montar([{ ...ENCONTRO_VAZIO }, { ...ENCONTRO_VAZIO }]);
      expect(screen.getByRole("button", { name: "Remover o encontro 1" })).toBeEnabled();
    });

    it("e o botão desabilitado DIZ por quê", () => {
      // Botão desabilitado sem explicação é um mistério: a pessoa clica, nada
      // acontece, e ela não tem como saber o motivo.
      montar();
      expect(
        screen.getByRole("button", { name: "Remover o encontro 1" }),
      ).toHaveAttribute("title", "A turma precisa de pelo menos um encontro");
    });
  });
});

describe("paraEnvio", () => {
  it("converte o dia para número, e só no envio", () => {
    // O estado é string porque `<Select>` e `<input type=time>` trabalham com
    // string. A conversão acontece uma vez, aqui.
    expect(
      paraEnvio([{ diaSemana: "6", horaInicio: "09:00", horaFim: "10:00" }]),
    ).toEqual([{ diaSemana: 6, horaInicio: "09:00", horaFim: "10:00" }]);
  });

  it("preserva a ordem", () => {
    const saida = paraEnvio([
      { diaSemana: "3", horaInicio: "18:00", horaFim: "19:00" },
      { diaSemana: "1", horaInicio: "07:00", horaFim: "08:00" },
    ]);
    expect(saida.map((e) => e.diaSemana)).toEqual([3, 1]);
  });
});
