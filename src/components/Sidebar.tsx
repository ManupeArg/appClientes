"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio", icon: "▦" },
  { href: "/clientes", label: "Clientes", icon: "👤" },
  { href: "/productos", label: "Productos", icon: "📦" },
  { href: "/remitos", label: "Remitos", icon: "🧾" },
  { href: "/pagos", label: "Pagos", icon: "💵" },
  { href: "/configuracion", label: "Configuración", icon: "⚙" },
];

export default function Sidebar({ nombre, rol, logout }: { nombre: string; rol: string; logout: () => Promise<void> }) {
  const path = usePathname();
  return (
    <aside className="no-print flex flex-col w-56 shrink-0 min-h-screen p-4" style={{ background: "#141c2e" }}>
      <div className="mb-6 px-2">
        <div className="text-2xl font-black text-white tracking-tight">MSP</div>
        <div className="text-xs" style={{ color: "#8a97b3" }}>Gestión comercial</div>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {links.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={"nav-link" + (active ? " active" : "")}>
              <span className="w-5 text-center">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 px-2 text-xs" style={{ color: "#8a97b3" }}>
        <div className="text-white font-semibold truncate">{nombre}</div>
        <div className="capitalize">{rol}</div>
        <form action={logout} className="mt-2">
          <button className="underline" type="submit">Cerrar sesión</button>
        </form>
      </div>
    </aside>
  );
}
