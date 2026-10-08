import Link from "next/link";
import type { UnidadNegocio } from "@/lib/types";

// Botones para filtrar un listado por unidad de negocio (vía ?unidad=)
export default function FiltroUnidad({ unidades, actual, base, extra = {} }: { unidades: UnidadNegocio[]; actual?: string; base: string; extra?: Record<string, string | undefined> }) {
  function href(u?: string) {
    const p = new URLSearchParams();
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); });
    if (u) p.set("unidad", u);
    const q = p.toString();
    return base + (q ? "?" + q : "");
  }
  return (
    <div className="flex flex-wrap gap-2 no-print">
      <Link href={href()} className={"btn btn-sm " + (!actual ? "btn-primary" : "btn-secondary")}>Todas</Link>
      {unidades.map((u) => (
        <Link
          key={u.id}
          href={href(u.id)}
          className="btn btn-sm"
          style={actual === u.id ? { background: u.color, color: "#fff", borderColor: u.color } : { background: "#fff", color: u.color, borderColor: u.color }}
        >
          {u.nombre}
        </Link>
      ))}
    </div>
  );
}
