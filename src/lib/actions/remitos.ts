"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ItemNuevo {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export async function crearRemito(datos: {
  cliente_id: string;
  fecha: string;
  tipo_precio: "minorista" | "mayorista";
  descuento: number;
  observaciones: string;
  items: ItemNuevo[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  if (!datos.cliente_id) return { ok: false, error: "Elegí un cliente" };
  const items = datos.items.filter((i) => i.producto_id && i.cantidad > 0);
  if (items.length === 0) return { ok: false, error: "Agregá al menos un producto" };

  const { data, error } = await supabase.rpc("crear_remito", {
    p_cliente_id: datos.cliente_id,
    p_fecha: datos.fecha,
    p_tipo_precio: datos.tipo_precio,
    p_descuento: datos.descuento || 0,
    p_observaciones: datos.observaciones || null,
    p_items: items,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/remitos");
  revalidatePath("/productos");
  revalidatePath("/clientes");
  return { ok: true, id: data as string };
}

export async function anularRemito(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("remitos")
    .update({ estado: "anulado", anulado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "emitido");
  if (error) redirect(`/remitos/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath("/remitos");
  revalidatePath("/productos");
  revalidatePath("/clientes");
  redirect(`/remitos/${id}?ok=` + encodeURIComponent("Remito anulado: se devolvió el stock y se revirtió en la cuenta corriente"));
}
