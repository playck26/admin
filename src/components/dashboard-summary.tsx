"use client";

import { useCallback, useEffect, useState } from "react";
import { EvasaoCard } from "@/components/evasao-card";
import Link from "next/link";
import { Users, Armchair, ArrowUpRight, CalendarDays } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
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
    <div className="flex w-full flex-col gap-6">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-primary-strong)] p-6 text-white shadow-[var(--shadow-elevated)] md:p-8">
        <span aria-hidden="true" className="court-lines pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-[var(--color-secondary)] uppercase">Visão geral</p>
            <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Sua arena em jogo</h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">Acompanhe alunos, turmas e uso das quadras no período selecionado.</p>
          </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="periodo" className="text-xs font-bold text-white/70">
            Período
          </Label>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 text-[var(--color-on-surface)]"><CalendarDays className="size-4 text-[var(--color-primary-strong)]" /><Input id="periodo" type="month" value={periodo} onChange={(e) => { setPeriodo(e.target.value); void load(e.target.value); }} className="h-10 w-40 border-0 p-0 focus-visible:ring-0" /></div>
        </div>
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : loading || !summary ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard icon={Users} label="Alunos ativos" value={String(summary.alunosAtivos)} />
          <KpiCard
            icon={Armchair}
            label="Ocupação de turmas"
            value={`${summary.ocupacaoTurmasPct}%`}
            description="Alunos alocados / capacidade das turmas ativas"
            progress={summary.ocupacaoTurmasPct}
          />
          <KpiCard
            icon={TennisCourtIcon}
            label="Ocupação de quadras"
            value={`${summary.ocupacaoQuadrasPct}%`}
            description="Horas ocupadas (turma + avulso) no período"
            progress={summary.ocupacaoQuadrasPct}
          />
        </div>
      )}

      {/* SPEC-015/TASK-004 — o cartão fica ACIMA do acesso rápido e abaixo
          dos KPIs: os números do topo dizem como o negócio está; este diz
          quem precisa de você hoje, que é a única coisa da tela que pede
          ação. Enterrá-lo no fim faria o alerta existir sem ser visto. */}
      <EvasaoCard />

      <div className="flex items-center justify-between border-t border-border pt-6"><h2 className="text-lg font-extrabold">Acesso rápido</h2><span className="text-xs font-bold text-[var(--color-on-surface-variant)]">Operação diária</span></div>
      <nav className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="flex items-center justify-between rounded-lg bg-white p-4 text-sm font-bold shadow-[var(--shadow-low)] ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-[var(--color-primary)]">
            {link.label}<ArrowUpRight className="size-4 text-[var(--color-primary-strong)]" />
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
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-border bg-[var(--color-surface-container-lowest)] p-5 shadow-[var(--shadow-low)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">{label}</h3>
        <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary-container)] text-[var(--color-primary-strong)]">
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
