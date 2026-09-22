"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearPago(formData: FormData) {
  const supabase = await createClient();
  const cliente_id = String(formData.get("cliente_id") ?? "");
  const monto = parseFloat(String(formData.get("monto") ?? "").replace(",", "."));
  const volverA = String(formData.get("volver_a") ?? "") || `/clientes/${cliente_id}`;
  const errorA = String(formData.get("volver_error") ?? "") || "/pagos/nuevo";

  if (!cliente_id) redirect(errorA + "?error=" + encodeURIComponent("Elegí un cliente"));
  if (!monto || monto <= 0) redirect(errorA + "?error=" + encodeURIComponent("El monto debe ser mayor a 0"));

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("pagos").insert({
    cliente_id,
    fecha: String(formData.get("fecha")),
    monto,
    medio: String(formData.get("medio") ?? "efectivo"),
    referencia: String(formData.get("referencia") ?? "").trim() || null,
    observaciones: String(formData.get("observaciones") ?? "").trim() || null,
    usuario_id: user?.id,
  });
  if (error) redirect(errorA + "?error=" + encodeURIComponent(error.message));
  revalidatePath("/pagos");
  revalidatePath("/clientes");
  redirect(volverA + "?ok=" + encodeURIComponent("Pago registrado"));
}

export async function anularPago(id: string, clienteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagos").update({ anulado: true }).eq("id", id).eq("anulado", false);
  if (error) redirect(`/clientes/${clienteId}?error=` + encodeURIComponent(error.message));
  revalidatePath("/pagos");
  revalidatePath("/clientes");
  redirect(`/clientes/${clienteId}?ok=` + encodeURIComponent("Pago anulado"));
}
