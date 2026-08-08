import { CourtsList } from "@/components/courts-list";

export default function QuadrasPage() {
  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <CourtsList />
      </div>
    </main>
  );
}
