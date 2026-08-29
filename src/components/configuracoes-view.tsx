"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  definirHorariosEmpresa,
  getHorariosEmpresa,
  type DiaHorario,
  type ResultadoHorarios,
} from "@/lib/api-client";
import {
  AvisoReservasAfetadas,
  HorariosEditor,
} from "@/components/horarios-editor";
import { ContratoDoClubeCard } from "@/components/contrato-do-clube-card";
import { LimiteDeTurmasCard } from "@/components/limite-de-turmas-card";
import { LinkCadastroCard } from "@/components/link-cadastro-card";
import { LogoDaEmpresaCard } from "@/components/logo-da-empresa-card";

/**
 * SPEC-010/REQ-001 — horário padrão da empresa.
 *
 * É o padrão: vale para toda quadra que não tenha horário próprio, e
 * mudá-lo aqui alcança todas elas na hora (REQ-003). A tela diz isso, para
 * o gerente entender o alcance do que está mexendo antes de salvar.
 */
export function ConfiguracoesView() {
  const [dias, setDias] = useState<DiaHorario[] | null>(null);
  const [quadrasProprias, setQuadrasProprias] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoHorarios | null>(null);

  useEffect(() => {
    getHorariosEmpresa()
      .then((r) => {
        setDias(r.padrao);
        setQuadrasProprias(r.quadrasComHorarioProprio.length);
      })
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        ),
      )
      .finally(() => setCarregando(false));
  }, []);

  async function salvar(novos: DiaHorario[]) {
    setErro(null);
    setResultado(null);
    setSalvando(true);
    try {
      setResultado(await definirHorariosEmpresa(novos));
      setDias(novos);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em]">
          Configurações
        </h1>
        <p className="mt-1 text-[var(--color-on-surface-variant)]">
          Logo da arena, horário de funcionamento padrão, link de cadastro de
          alunos, limite de turmas por aluno e o contrato do clube.
        </p>
      </div>

      {/* SPEC-018/TASK-006 — primeiro cartão de propósito: é o único item
          desta tela que muda o que o ALUNO vê, e o que aparece na página
          pública de cadastro. */}
      <LogoDaEmpresaCard />

      <LinkCadastroCard />

      {/* SPEC-023 — logo abaixo do link de cadastro de proposito: os dois
          decidem ate onde vai o "sozinho" do aluno. Um controla quem entra
          no clube; o outro, em quantas turmas. */}
      <LimiteDeTurmasCard />

      {/* SPEC-024 — o contrato fica junto do resto que o aluno enxerga.
          Publicar aqui interrompe todo mundo no proximo acesso, e o cartao
          diz isso com o numero na frente antes de confirmar. */}
      <ContratoDoClubeCard />

      {carregando ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : dias ? (
        <div className="rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
          <HorariosEditor
            dias={dias}
            salvando={salvando}
            onSalvar={(d) => void salvar(d)}
            rodape={
              <p className="max-w-md text-sm text-[var(--color-on-surface-variant)]">
                {quadrasProprias === 0
                  ? "Vale para todas as quadras."
                  : `Vale para as quadras que não têm horário próprio. ${quadrasProprias} ${quadrasProprias === 1 ? "quadra tem" : "quadras têm"} horário próprio e não ${quadrasProprias === 1 ? "será afetada" : "serão afetadas"}.`}
              </p>
            }
          />
          {resultado ? <AvisoReservasAfetadas {...resultado} /> : null}
          {erro ? (
            <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
              {erro}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
