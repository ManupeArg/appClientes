"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ImputacionNueva {
  remito_id: string;
  monto: number;
}

export async function crearPago(datos: {
  cliente_id: string;
  monto: number;
  medio: string;
  referencia: string;
  observaciones: string;
  imputaciones: ImputacionNueva[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  if (!datos.cliente_id) return { ok: false, error: "Elegí un cliente" };
  if (!datos.monto || datos.monto <= 0) return { ok: false, error: "El monto debe ser mayor a 0" };
  const imputaciones = datos.imputaciones.filter((i) => i.remito_id && i.monto > 0).map((i) => ({ ...i, monto: Math.round(i.monto * 100) / 100 }));
  const suma = imputaciones.reduce((a, i) => a + i.monto, 0);
  if (suma > datos.monto + 0.009) return { ok: false, error: "Lo imputado a remitos supera el monto del pago" };

  const { data, error } = await supabase.rpc("crear_pago", {
    p_cliente_id: datos.cliente_id,
    p_monto: datos.monto,
    p_medio: datos.medio || "efectivo",
    p_referencia: datos.referencia || null,
    p_observaciones: datos.observaciones || null,
    p_imputaciones: imputaciones,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, id: data as string };
}

export async function imputarPago(pagoId: string, imputaciones: ImputacionNueva[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const lista = imputaciones.filter((i) => i.remito_id && i.monto > 0).map((i) => ({ ...i, monto: Math.round(i.monto * 100) / 100 }));
  if (!lista.length) return { ok: false, error: "No elegiste ningún remito" };
  const { error } = await supabase.rpc("imputar_pago", { p_pago_id: pagoId, p_imputaciones: lista });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function quitarImputacion(id: string, volverA: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("quitar_imputacion", { p_imputacion_id: id });
  if (error) redirect(volverA + "?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect(volverA + "?ok=" + encodeURIComponent("Imputación quitada: ese importe volvió a quedar a cuenta del cliente"));
}

export async function anularPago(id: string, volverA: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagos").update({ anulado: true }).eq("id", id).eq("anulado", false);
  if (error) redirect(volverA + "?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect(volverA + "?ok=" + encodeURIComponent("Pago anulado"));
}
