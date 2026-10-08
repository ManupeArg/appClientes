import type { UnidadNegocio } from "@/lib/types";
import { colorUnidad, nombreUnidad } from "@/lib/unidades";

export default function UnidadBadge({ unidades, id }: { unidades: UnidadNegocio[]; id: string | null | undefined }) {
  const color = colorUnidad(unidades, id);
  return (
    <span className="badge" style={{ background: color + "22", color }}>{nombreUnidad(unidades, id)}</span>
  );
}
