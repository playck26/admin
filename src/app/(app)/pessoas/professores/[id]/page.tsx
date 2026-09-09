import { EditTeacherForm } from "@/components/edit-teacher-form";
import { DisponibilidadeDoProfessor } from "@/components/disponibilidade-do-professor";

export default async function EditarProfessorPage({ params }: PageProps<"/pessoas/professores/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10">
      <EditTeacherForm id={id} />
      {/* SPEC-040/TASK-003 — a disponibilidade fica na ficha pelo mesmo motivo
          da carteira do aluno: quem configura a agenda esta olhando para uma
          pessoa. Uma tela propria obrigaria a escolher o professor de novo,
          depois de ja te-lo escolhido. */}
      <DisponibilidadeDoProfessor professorId={id} />
    </div>
  );
}
