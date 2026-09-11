import { DashboardSummaryView } from "@/components/dashboard-summary";
import { VencimentosCard } from "@/components/vencimentos-card";

/**
 * SPEC-045 — o card de vencimentos entra AQUI, e não em Configurações.
 *
 * `PlanosCard` mora em Configurações porque criar plano é montagem do clube,
 * feita uma vez. **Vencimento é operação**: é a lista que o gestor precisa ver
 * na semana, ao lado dos números que ele já abre o painel para ver.
 *
 * A rota `/dashboard` da API continua com três números agregados (D6) — o card
 * chama `/matriculas/vencimentos` por conta própria. A tela pode juntar o que
 * a API mantém separado; o contrário não.
 */
export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 py-6">
      <DashboardSummaryView />
      <VencimentosCard />
    </div>
  );
}
