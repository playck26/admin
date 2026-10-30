"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, exportarAlunos } from "@/lib/api-client";

/**
 * SPEC-092/D7 — **o que este arquivo ainda não faz, dito antes do clique.**
 *
 * A importação de hoje recusa a coluna `Status` e o e-mail de quem já existe
 * (as turmas extras, até a Turma 10, ela já aceita: SPEC-092/D8). Sem esta
 * linha, o gestor editaria a planilha exportada e a reenviaria esperando
 * atualizar os alunos — e receberia uma recusa por linha. A atualização pela
 * planilha é a fase 2.
 */
export const AVISO_DA_EXPORTACAO =
  "Para consultar e guardar: este arquivo ainda não atualiza alunos se for enviado de volta pela importação.";

/**
 * SPEC-092 — o botão "Exportar alunos": todos os alunos do clube (ativos,
 * desativados e pendentes), no formato do modelo da importação.
 */
export function ExportarAlunos() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar() {
    setErro(null);
    setOcupado(true);
    try {
      const { nomeDoArquivo, arquivo } = await exportarAlunos();
      const url = URL.createObjectURL(arquivo);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo;
      a.click();
      // Revogar no mesmo instante do clique pode cancelar o download em
      // alguns navegadores: a URL é solta depois que o clique foi atendido.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível exportar.",
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={exportar}
          disabled={ocupado}
          className="h-9 px-4 text-[12px] font-semibold"
        >
          {ocupado ? "Exportando…" : "Exportar alunos"}
        </Button>
        <span className="text-xs text-[var(--color-on-surface-variant)]">
          {AVISO_DA_EXPORTACAO}
        </span>
      </div>
      {erro ? (
        <p
          role="alert"
          className="text-sm font-semibold text-[var(--color-error)]"
        >
          {erro}
        </p>
      ) : null}
    </div>
  );
}
