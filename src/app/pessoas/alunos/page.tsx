import { StudentsList } from "@/components/students-list";

export default function AlunosPage() {
  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <StudentsList />
      </div>
    </main>
  );
}
