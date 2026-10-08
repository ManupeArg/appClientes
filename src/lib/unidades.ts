import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnidadNegocio } from "@/lib/types";

export async function getUnidades(supabase: SupabaseClient, soloActivas = true): Promise<UnidadNegocio[]> {
  let q = supabase.from("unidades_negocio").select("*").order("orden").order("nombre");
  if (soloActivas) q = q.eq("activo", true);
  const { data } = await q;
  return (data ?? []) as UnidadNegocio[];
}

export function nombreUnidad(unidades: UnidadNegocio[], id: string | null | undefined) {
  if (!id) return "Sin unidad";
  return unidades.find((u) => u.id === id)?.nombre ?? "—";
}

export function colorUnidad(unidades: UnidadNegocio[], id: string | null | undefined) {
  if (!id) return "#6b7280";
  return unidades.find((u) => u.id === id)?.color ?? "#6b7280";
}
