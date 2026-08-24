import { EditStudentForm } from "@/components/edit-student-form";
import { FrequenciaAluno } from "@/components/frequencia-aluno";

export default async function EditarAlunoPage({ params }: PageProps<"/pessoas/alunos/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10">
      <EditStudentForm id={id} />
      {/* SPEC-015/TASK-004 — a frequência fica DEPOIS do cadastro, na mesma
          tela: quem abre a ficha do aluno costuma vir de um alerta de
          evasão, e precisa do número junto do contato para agir. */}
      <FrequenciaAluno alunoId={id} />
    </div>
  );
}
