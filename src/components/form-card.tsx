import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

// Wrapper visual compartilhado pelos formulários de cadastro/edição
// (Aluno, Professor, Turma, Quadra, Pagamentos) — mesmo card branco,
// título page-title + descrição, usado em todas as telas de formulário
// da referência (novo_aluno_playck_admin e o padrão documentado em
// DESIGN.md pras demais).
export function FormCard({
  title,
  description,
  children,
  className = "max-w-2xl",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full ${className} rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-8 shadow-[var(--shadow-low)]`}
    >
      <div className="mb-8">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-[var(--color-on-surface)]">{title}</h1>
        {description ? <div className="mt-2 text-sm text-[var(--color-on-surface-variant)]">{description}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function FormActions({
  submitLabel,
  loadingLabel,
  loading,
  submitDisabled = false,
  onCancel,
  cancelLabel = "Cancelar",
}: {
  submitLabel: string;
  loadingLabel: string;
  loading: boolean;
  submitDisabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-4 border-t border-border pt-6">
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 border-[1.5px] border-primary px-6 text-[13px] font-semibold text-primary hover:bg-primary/5"
          onClick={onCancel}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
      ) : null}
      <Button type="submit" disabled={loading || submitDisabled} className="h-11 px-6 text-[13px] font-semibold">
        {loading ? loadingLabel : submitLabel}
      </Button>
    </div>
  );
}
