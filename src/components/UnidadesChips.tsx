import type { UnidadNegocio } from "@/lib/types";
import { formatoMoneda } from "@/lib/utils";

// Muestra las unidades que participan en un remito/pago con su importe
export default function UnidadesChips({ unidades, partes, conImporte = true }: { unidades: UnidadNegocio[]; partes: { unidad_negocio_id: string | null; importe: number }[]; conImporte?: boolean }) {
  if (!partes.length) return <span className="badge badge-muted">sin unidad</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {partes.map((p) => {
        const u = unidades.find((x) => x.id === p.unidad_negocio_id);
        const color = u?.color ?? "#6b7280";
        return (
          <span key={p.unidad_negocio_id ?? "null"} className="badge" style={{ background: color + "22", color, textTransform: "none" }}>
            {u?.nombre ?? "Sin unidad"}{conImporte ? ` ${formatoMoneda(p.importe)}` : ""}
          </span>
        );
      })}
    </span>
  );
}
