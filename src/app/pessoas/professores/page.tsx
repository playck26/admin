import { TeachersList } from "@/components/teachers-list";

export default function ProfessoresPage() {
  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <TeachersList />
      </div>
    </main>
  );
}
