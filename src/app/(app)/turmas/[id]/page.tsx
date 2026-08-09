import { ClassManager } from "@/components/class-manager";

export default async function GerenciarTurmaPage({ params }: PageProps<"/turmas/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-6xl py-6">
      <ClassManager id={id} />
    </div>
  );
}
