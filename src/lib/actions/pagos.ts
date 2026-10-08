"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearPago(formData: FormData) {
  const supabase = await createClient();
  const cliente_id = String(formData.get("cliente_id") ?? "");
  const remito_id = String(formData.get("remito_id") ?? "");
  const monto = parseFloat(String(formData.get("monto") ?? "").replace(",", "."));
  const errorA = String(formData.get("volver_error") ?? "") || "/pagos/nuevo";

  if (!cliente_id) redirect(errorA + "?error=" + encodeURIComponent("Elegí un cliente"));
  if (!remito_id) redirect(errorA + "?error=" + encodeURIComponent("Elegí el remito que se está pagando"));
  if (!monto || monto <= 0) redirect(errorA + "?error=" + encodeURIComponent("El monto debe ser mayor a 0"));

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("pagos").insert({
    cliente_id,
    remito_id,
    monto,
    medio: String(formData.get("medio") ?? "efectivo"),
    referencia: String(formData.get("referencia") ?? "").trim() || null,
    observaciones: String(formData.get("observaciones") ?? "").trim() || null,
    usuario_id: user?.id,
    // la fecha la pone la base automáticamente (hoy, hora Argentina)
  });
  if (error) redirect(errorA + "?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect(`/remitos/${remito_id}?ok=` + encodeURIComponent("Pago registrado"));
}

export async function anularPago(id: string, volverA: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagos").update({ anulado: true }).eq("id", id).eq("anulado", false);
  if (error) redirect(volverA + "?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect(volverA + "?ok=" + encodeURIComponent("Pago anulado"));
}
