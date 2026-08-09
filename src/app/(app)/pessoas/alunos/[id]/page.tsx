import { EditStudentForm } from "@/components/edit-student-form";

export default async function EditarAlunoPage({ params }: PageProps<"/pessoas/alunos/[id]">) {
  const { id } = await params;

  return (
    <div className="flex justify-center py-10">
      <EditStudentForm id={id} />
    </div>
  );
}
