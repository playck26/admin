import { CourtManager } from "@/components/court-manager";

export default async function GerenciarQuadraPage({ params }: PageProps<"/quadras/[id]">) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-6xl py-6">
      <CourtManager id={id} />
    </div>
  );
}
