import { ImportarAlunos } from "@/components/importar-alunos";
import { StudentsList } from "@/components/students-list";

export default function AlunosPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <StudentsList />
      {/* SPEC-038/TASK-004 — a importação fica DEPOIS da lista, e não como
          página própria: quem sobe planilha está olhando para os alunos que
          já existem, e é olhando para eles que percebe que faltam trezentos.
          Um item novo no menu para uma operação de mudança de sistema seria
          pagar navegação permanente por um gesto que acontece uma vez. */}
      <ImportarAlunos />
    </div>
  );
}
