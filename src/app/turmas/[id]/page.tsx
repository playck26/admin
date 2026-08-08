import { ClassManager } from "@/components/class-manager";

export default async function GerenciarTurmaPage({ params }: PageProps<"/turmas/[id]">) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <ClassManager id={id} />
    </main>
  );
}
