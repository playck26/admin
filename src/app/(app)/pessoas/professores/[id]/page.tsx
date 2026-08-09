import { EditTeacherForm } from "@/components/edit-teacher-form";

export default async function EditarProfessorPage({ params }: PageProps<"/pessoas/professores/[id]">) {
  const { id } = await params;

  return (
    <div className="flex justify-center py-10">
      <EditTeacherForm id={id} />
    </div>
  );
}
