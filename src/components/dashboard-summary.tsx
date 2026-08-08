"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, getDashboardSummary, type DashboardSummary } from "@/lib/api-client";

function mesAtualIso(): string {
  return new Date().toISOString().slice(0, 7);
}

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
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="periodo" className="text-xs">
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
            />
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : loading || !summary ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Alunos ativos</CardDescription>
              <CardTitle className="text-4xl">{summary.alunosAtivos}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Ocupação de turmas</CardDescription>
              <CardTitle className="text-4xl">{summary.ocupacaoTurmasPct}%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--color-text-secondary)]">Alunos alocados / capacidade das turmas ativas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Ocupação de quadras</CardDescription>
              <CardTitle className="text-4xl">{summary.ocupacaoQuadrasPct}%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--color-text-secondary)]">Horas ocupadas (turma + avulso) no período</p>
            </CardContent>
          </Card>
        </div>
      )}

      <nav className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link href="/pessoas/alunos" className="text-[var(--color-primary)] hover:underline">
          Alunos
        </Link>
        <Link href="/pessoas/professores" className="text-[var(--color-primary)] hover:underline">
          Professores
        </Link>
        <Link href="/pessoas/niveis" className="text-[var(--color-primary)] hover:underline">
          Níveis
        </Link>
        <Link href="/quadras" className="text-[var(--color-primary)] hover:underline">
          Quadras
        </Link>
        <Link href="/turmas" className="text-[var(--color-primary)] hover:underline">
          Turmas
        </Link>
      </nav>
    </div>
  );
}
