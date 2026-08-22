"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AvisoReservasAfetadas,
  HorariosEditor,
} from "@/components/horarios-editor";
import {
  ApiError,
  definirHorariosQuadra,
  getHorariosQuadra,
  removerHorariosQuadra,
  type DiaHorario,
  type ResultadoHorarios,
} from "@/lib/api-client";

/**
 * SPEC-010/REQ-002 — horário próprio da quadra.
 *
 * A tela precisa deixar claro **de onde vem** o horário exibido (`origem`).
 * Sem isso, o gerente editaria a quadra achando que está vendo uma
 * configuração dela, e depois mudaria o padrão da empresa esperando efeito
 * aqui — ou o contrário.
 */
export function HorarioQuadraSection({ quadraId }: { quadraId: string }) {
  const [dias, setDias] = useState<DiaHorario[] | null>(null);
  const [origem, setOrigem] = useState<"proprio" | "herdado">("herdado");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoHorarios | null>(null);

  function carregar() {
    return getHorariosQuadra(quadraId)
      .then((r) => {
        setDias(r.dias);
        setOrigem(r.origem);
      })
      .catch((e: unknown) =>
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar."),
      )
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quadraId]);

  async function executar(acao: () => Promise<ResultadoHorarios>) {
    setErro(null);
    setResultado(null);
    setSalvando(true);
    try {
      setResultado(await acao());
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">
          Horário de funcionamento
        </h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          {origem === "herdado"
            ? "Esta quadra segue o horário padrão da empresa. Salvar aqui cria um horário próprio para ela."
            : "Esta quadra tem horário próprio e não acompanha mudanças no padrão da empresa."}
        </p>
      </div>

      {carregando ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : dias ? (
        <>
          <HorariosEditor
            key={origem + String(dias.length)}
            dias={dias}
            salvando={salvando}
            onSalvar={(d) => void executar(() => definirHorariosQuadra(quadraId, d))}
            rodape={
              origem === "proprio" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={salvando}
                  onClick={() => void executar(() => removerHorariosQuadra(quadraId))}
                >
                  Voltar a usar o padrão da empresa
                </Button>
              ) : undefined
            }
          />
          {resultado ? <AvisoReservasAfetadas {...resultado} /> : null}
          {erro ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {erro}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
