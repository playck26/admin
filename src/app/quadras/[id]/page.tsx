import { CourtManager } from "@/components/court-manager";

export default async function GerenciarQuadraPage({ params }: PageProps<"/quadras/[id]">) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <CourtManager id={id} />
    </main>
  );
}
