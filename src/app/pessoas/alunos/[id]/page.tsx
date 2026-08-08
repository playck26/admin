import { EditStudentForm } from "@/components/edit-student-form";

export default async function EditarAlunoPage({ params }: PageProps<"/pessoas/alunos/[id]">) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <EditStudentForm id={id} />
    </main>
  );
}
