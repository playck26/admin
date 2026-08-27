"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIAS_SEMANA } from "@/lib/dias-semana";

/**
 * SPEC-019/TASK-004 — o editor da recorrência da turma.
 *
 * **Substituiu três campos soltos** (dia, início, fim) por uma lista. É o
 * pedido que originou a spec: *"só consigo adicionar a aula a um dia da
 * semana"*.
 *
 * ## Por que um componente, e não o mesmo bloco copiado nos dois formulários
 *
 * Criar e editar turma mostram exatamente a mesma coisa. Duas cópias
 * divergiriam no primeiro ajuste — foi o que motivou o
 * `catalogo-de-quadra-manager` da SPEC-020, e a divergência apareceria como
 * *"na criação dá para remover o último e na edição não"*.
 *
 * ## O estado é string, e é de propósito
 *
 * `<Select>` e `<Input type="time">` trabalham com string. Converter para
 * número aqui obrigaria a converter de volta a cada render, e um `Number("")`
 * silencioso viraria `0` — domingo — sem ninguém escolher domingo.
 * A conversão acontece **uma vez**, no envio.
 */

export interface EncontroForm {
  diaSemana: string;
  horaInicio: string;
  horaFim: string;
}

export const ENCONTRO_VAZIO: EncontroForm = {
  diaSemana: "1",
  horaInicio: "",
  horaFim: "",
};

/**
 * Converte para o formato que a API espera. **Uma vez, no envio** — ver
 * acima.
 */
export function paraEnvio(encontros: EncontroForm[]) {
  return encontros.map((encontro) => ({
    diaSemana: Number(encontro.diaSemana),
    horaInicio: encontro.horaInicio,
    horaFim: encontro.horaFim,
  }));
}

export function EncontrosField({
  encontros,
  onChange,
  disabled,
}: {
  encontros: EncontroForm[];
  onChange: (encontros: EncontroForm[]) => void;
  disabled?: boolean;
}) {
  const alterar = (indice: number, campo: keyof EncontroForm, valor: string) => {
    onChange(
      encontros.map((encontro, i) =>
        i === indice ? { ...encontro, [campo]: valor } : encontro,
      ),
    );
  };

  const remover = (indice: number) => {
    onChange(encontros.filter((_, i) => i !== indice));
  };

  // INV-051 — o servidor recusa turma sem encontro com `TURMA_SEM_ENCONTRO`,
  // e a tela não deve deixar chegar lá. **Não é validação duplicada:** o
  // servidor continua sendo quem garante; aqui o botão desabilitado evita
  // que o gestor descubra a regra por mensagem de erro.
  const podeRemover = encontros.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Encontros da semana</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...encontros, { ...ENCONTRO_VAZIO }])}
          disabled={disabled}
        >
          <Plus className="mr-1 size-4" aria-hidden="true" />
          Adicionar encontro
        </Button>
      </div>

      <p className="text-xs text-[var(--color-on-surface-variant)]">
        A turma pode acontecer em mais de um dia, com horário próprio em cada
        um.
      </p>

      {encontros.map((encontro, indice) => (
        <div
          key={indice}
          className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-xl border border-border p-3"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={`encontro-${indice}-dia`} className="text-xs">
              Dia
            </Label>
            <Select
              value={encontro.diaSemana}
              onValueChange={(valor) => alterar(indice, "diaSemana", valor)}
              disabled={disabled}
            >
              <SelectTrigger
                id={`encontro-${indice}-dia`}
                className="h-10 w-full px-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map((label, dia) => (
                  <SelectItem key={label} value={String(dia)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={`encontro-${indice}-inicio`} className="text-xs">
              Início
            </Label>
            <Input
              id={`encontro-${indice}-inicio`}
              type="time"
              required
              value={encontro.horaInicio}
              onChange={(e) => alterar(indice, "horaInicio", e.target.value)}
              disabled={disabled}
              className="h-10 px-3"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={`encontro-${indice}-fim`} className="text-xs">
              Fim
            </Label>
            <Input
              id={`encontro-${indice}-fim`}
              type="time"
              required
              value={encontro.horaFim}
              onChange={(e) => alterar(indice, "horaFim", e.target.value)}
              disabled={disabled}
              className="h-10 px-3"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={() => remover(indice)}
            disabled={disabled || !podeRemover}
            // Sem o título, o botão desabilitado é um mistério: o gestor
            // clica, nada acontece, e ele não tem como saber por quê.
            title={
              podeRemover
                ? `Remover o encontro ${indice + 1}`
                : "A turma precisa de pelo menos um encontro"
            }
            aria-label={`Remover o encontro ${indice + 1}`}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  );
}
