import Link from "next/link";

// Placeholder (AC-007, SPEC-001) — dashboard real (KPIs) chega na spec 004,
// depois que a spec 003 (turmas) estiver completa.
export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Os KPIs completos chegam depois que turmas (spec 003) estiver pronta.
        </p>
      </div>
      <nav className="flex flex-wrap justify-center gap-3">
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
      </nav>
    </main>
  );
}
