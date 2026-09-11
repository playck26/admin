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
  criarMatricula,
  listarMatriculas,
  listarPlanos,
  type Matricula,
  type Plano,
} from "@/lib/api-client";

/**
 * SPEC-037/REQ-002 — matricular o aluno num plano.
 *
 * ## Não há editar nem excluir, e é a INV-112
 *
 * Valor e prazo são **imutáveis**: mudar o contratado depois apagaria o
 * registro de com o que o aluno concordou — e é esse registro que dá valor
 * legal ao aceite. **Renovar é uma matrícula nova** (D4): duas seguidas
 * contam a história certa; uma linha editada conta a última.
 *
 * ## As três recusas viram mensagem, e cada uma tem uma saída diferente
 *
 * | `code` | O que o gestor faz |
 * |---|---|
 * | `CONTRATO_NAO_ACEITO` | pede ao aluno que abra o app e aceite |
 * | `CONTRATO_NAO_PUBLICADO` | publica o contrato em Configurações |
 * | `PLANO_INATIVO` | reativa o plano, ou escolhe outro |
 *
 * *Sem a distinção, as três apareceriam como "não foi possível matricular" —
 * e as três têm soluções que não se parecem.*
 */
function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** `2026-09-10` → `10/09/2026`. Sem `new Date(iso)`: fuso (DEF-020). */
function porExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const MENSAGEM: Record<string, string> = {
  CONTRATO_NAO_ACEITO:
    "Este aluno ainda não aceitou a versão vigente do contrato. Peça que ele entre no app e aceite — a matrícula depende disso.",
  CONTRATO_NAO_PUBLICADO:
    "O clube ainda não publicou um contrato. Publique em Configurações antes de matricular.",
  PLANO_INATIVO:
    "Este plano está inativo. Reative-o na lista de planos, ou escolha outro.",
};

export function MatriculaDoAluno({ alunoId }: { alunoId: string }) {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoId, setPlanoId] = useState("");
  const [inicio, setInicio] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarMatriculas(alunoId), listarPlanos(true)])
      .then(([m, p]) => {
        if (!vivo) return;
        setMatriculas(m);
        setPlanos(p);
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar as matrículas.");
      });
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  const plano = planos.find((p) => p.id === planoId);

  async function matricular(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const nova = await criarMatricula(alunoId, {
        planoId,
        inicio: inicio === "" ? undefined : inicio,
        // **`undefined` e não `0` quando em branco.** Zero é bolsa integral,
        // um valor legítimo — mandá-lo por engano daria a aula de graça.
        valorCentavos:
          valor === "" ? undefined : Math.round(Number(valor) * 100),
      });
      setMatriculas((atuais) => [nova, ...atuais]);
      setValor("");
      setInicio("");
    } catch (e) {
      // Pelo `code`, nunca pelo texto — a mesma regra do D7 da SPEC-033.
      const code = e instanceof ApiError ? e.code : undefined;
      setErro(
        (code ? MENSAGEM[code] : undefined) ??
          (e instanceof ApiError ? e.message : "Não foi possível matricular."),
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <FormCard
      title="Matrícula"
      description="O plano contratado, com o valor e o prazo congelados no dia. Renovar é uma matrícula nova — a anterior fica como registro."
    >
      {matriculas.length === 0 ? (
        <p className="pb-4 text-sm text-[var(--color-on-surface-variant)]">
          Este aluno ainda não tem matrícula.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {matriculas.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <span className="text-sm font-semibold">
                {m.planoNome ?? "Plano"}
              </span>
              <span className="text-sm">{emReais(m.valorCentavos)}</span>
              {m.descontoCentavos > 0 ? (
                <span className="text-xs font-medium text-[var(--color-primary)]">
                  {/* O desconto só é visível porque a matrícula congelou os
                      DOIS valores. Com um só, ninguém distinguiria desconto
                      de mudança de preço depois. */}
                  desconto de {emReais(m.descontoCentavos)} sobre{" "}
                  {emReais(m.valorDeTabelaCentavos)}
                </span>
              ) : null}
              <span className="text-xs text-[var(--color-on-surface-variant)]">
                {porExtenso(m.inicio)} a {porExtenso(m.fim)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => void matricular(e)}
        className="flex flex-col gap-4 border-t border-border pt-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="mat-plano">Plano</Label>
          <Select
            value={planoId}
            onValueChange={setPlanoId}
            disabled={salvando}
          >
            <SelectTrigger id="mat-plano" className="h-10 w-full px-3">
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent>
              {/* Só os ATIVOS: oferecer um inativo seria oferecer o que o
                  servidor recusa com `422 PLANO_INATIVO`. */}
              {planos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} · {emReais(p.valorCentavos)} ·{" "}
                  {p.prazoMeses === 1 ? "1 mês" : `${p.prazoMeses} meses`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {planos.length === 0 ? (
            <p className="text-xs text-[var(--color-error)]">
              Nenhum plano ativo. Crie um em Configurações antes de matricular.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex min-w-40 flex-1 flex-col gap-2">
            <Label htmlFor="mat-inicio">Início</Label>
            <Input
              id="mat-inicio"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              disabled={salvando}
              className="h-10 px-3"
            />
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Em branco, começa hoje.
            </p>
          </div>
          <div className="flex w-40 flex-col gap-2">
            <Label htmlFor="mat-valor">Valor combinado (R$)</Label>
            <Input
              id="mat-valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={salvando}
              className="h-10 px-3"
            />
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              {plano
                ? `Em branco, cobra ${emReais(plano.valorCentavos)}.`
                : "Em branco, cobra o valor do plano."}
            </p>
          </div>
        </div>

        {erro ? (
          <p
            role="alert"
            className="text-sm font-semibold text-[var(--color-error)]"
          >
            {erro}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={salvando || planoId === ""}
            className="h-10 px-5 text-[13px] font-semibold"
          >
            {salvando ? "Matriculando..." : "Matricular"}
          </Button>
        </div>
      </form>
    </FormCard>
  );
}
