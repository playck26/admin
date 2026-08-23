import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-court-dark)] p-4">
      <span aria-hidden="true" className="court-lines pointer-events-none absolute inset-0 opacity-20" />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--color-secondary)]" />
      <div className="relative z-10 min-w-0 w-full max-w-[430px]">
        <LoginForm />
      </div>
    </main>
  );
}
