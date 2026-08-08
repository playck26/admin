import { EditTeacherForm } from "@/components/edit-teacher-form";

export default async function EditarProfessorPage({ params }: PageProps<"/pessoas/professores/[id]">) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <EditTeacherForm id={id} />
    </main>
  );
}
