import { CatalogoDeQuadraManager } from "@/components/catalogo-de-quadra-manager";

/**
 * SPEC-020/TASK-005 — os dois catálogos de quadra, na mesma tela.
 *
 * **Juntos e não em duas rotas** porque são a mesma pergunta feita duas
 * vezes: "como este clube classifica as quadras dele?". Separá-los daria
 * duas entradas de menu para uma decisão só, e o gestor teria de descobrir
 * que precisa visitar as duas antes de cadastrar a primeira quadra.
 *
 * Fica sob `/quadras` porque é dali que se chega — quem vem cadastrar uma
 * quadra e não encontra o esporte na lista precisa de um caminho curto.
 */
export default function CatalogosDeQuadraPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <CatalogoDeQuadraManager
        catalogo="court-sports"
        titulo="Esportes"
        descricao="O que se joga nas suas quadras. Vira filtro no app do aluno."
        exemplo="Tênis"
      />
      <CatalogoDeQuadraManager
        catalogo="court-categories"
        titulo="Categorias de piso"
        descricao="Terra, sintética, rápida. Opcional — só cadastre se o seu clube diferencia."
        exemplo="Saibro"
      />
    </div>
  );
}
