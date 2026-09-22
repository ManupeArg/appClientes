import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();

  if (perfil && !perfil.activo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-sm text-center">
          <p className="font-semibold">Tu usuario está desactivado.</p>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Pedile al administrador que lo active.</p>
          <form action={logout} className="mt-4"><button className="btn btn-secondary">Cerrar sesión</button></form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar nombre={perfil?.nombre ?? user.email ?? ""} rol={perfil?.rol ?? "vendedor"} logout={logout} />
      <main className="flex-1 p-6 md:p-8 max-w-7xl">{children}</main>
    </div>
  );
}
