import { EditTeacherForm } from "@/components/edit-teacher-form";
import { DisponibilidadeDoProfessor } from "@/components/disponibilidade-do-professor";
import { MarcarAulaParticular } from "@/components/marcar-aula-particular";

export default async function EditarProfessorPage({
  params,
}: PageProps<"/pessoas/professores/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10">
      <EditTeacherForm id={id} />
      {/* SPEC-040/TASK-003 — a disponibilidade fica na ficha pelo mesmo motivo
          da carteira do aluno: quem configura a agenda esta olhando para uma
          pessoa. Uma tela propria obrigaria a escolher o professor de novo,
          depois de ja te-lo escolhido. */}
      <DisponibilidadeDoProfessor professorId={id} />
      {/* SPEC-039 — marcar aula LOGO ABAIXO da disponibilidade, e a ordem e a
          decisao: o gestor configura quando o professor atende e, na mesma
          tela, marca dentro dessa janela.

          A tela da quadra ja marcava aula, e ninguem achava: la o seletor de
          professor vive dentro do formulario de reserva, que so nasce depois
          de escolher a data, pedir a disponibilidade e clicar num horario.
          Feature que existe e nao e alcancavel e feature que nao existe. */}
      <MarcarAulaParticular professorId={id} />
    </div>
  );
}
