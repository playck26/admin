"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, Armchair, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, getDashboardSummary, type DashboardSummary } from "@/lib/api-client";

function mesAtualIso(): string {
  return new Date().toISOString().slice(0, 7);
}

const NAV_LINKS = [
  { href: "/pessoas/alunos", label: "Alunos" },
  { href: "/pessoas/professores", label: "Professores" },
  { href: "/pessoas/niveis", label: "Níveis" },
  { href: "/quadras", label: "Quadras" },
  { href: "/turmas", label: "Turmas" },
  { href: "/pagamentos", label: "Pagamento" },
];

export function DashboardSummaryView() {
  const [periodo, setPeriodo] = useState(mesAtualIso());
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPeriodo: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardSummary(targetPeriodo);
      setSummary(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(periodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-[var(--color-on-surface)]">
          Dashboard
        </h1>
        <div className="flex flex-col gap-1">
          <Label htmlFor="periodo" className="text-xs text-[var(--color-on-surface-variant)]">
            Mês
          </Label>
          <Input
            id="periodo"
            type="month"
            value={periodo}
            onChange={(e) => {
              setPeriodo(e.target.value);
              void load(e.target.value);
            }}
            className="w-44"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : loading || !summary ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <KpiCard icon={Users} label="Alunos ativos" value={String(summary.alunosAtivos)} />
          <KpiCard
            icon={Armchair}
            label="Ocupação de turmas"
            value={`${summary.ocupacaoTurmasPct}%`}
            description="Alunos alocados / capacidade das turmas ativas"
            progress={summary.ocupacaoTurmasPct}
          />
          <KpiCard
            icon={LayoutGrid}
            label="Ocupação de quadras"
            value={`${summary.ocupacaoQuadrasPct}%`}
            description="Horas ocupadas (turma + avulso) no período"
            progress={summary.ocupacaoQuadrasPct}
          />
        </div>
      )}

      <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm font-medium text-primary hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  description,
  progress,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  description?: string;
  progress?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">{label}</h3>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-[18px]" />
        </div>
      </div>
      <p className="mb-2 text-[42px] leading-tight font-bold text-[var(--color-on-surface)]">{value}</p>
      {description ? <p className="text-xs text-[var(--color-on-surface-variant)]">{description}</p> : null}
      {progress !== undefined ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-variant)]">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
}
