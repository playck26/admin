import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopBar } from "@/components/admin-top-bar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex min-h-screen flex-col md:ml-[250px]">
        <AdminTopBar />
        <main className="flex-1 px-4 pb-12 md:px-8">{children}</main>
      </div>
    </div>
  );
}
