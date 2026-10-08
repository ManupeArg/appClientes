"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarNegocio(formData: FormData) {
  const supabase = await createClient();
  const valor = {
    nombre: String(formData.get("nombre") ?? "MSP").trim() || "MSP",
    cuit: String(formData.get("cuit") ?? "").trim(),
    direccion: String(formData.get("direccion") ?? "").trim(),
    telefono: String(formData.get("telefono") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
  };
  const { error } = await supabase.from("configuracion").upsert({ clave: "negocio", valor, actualizado_en: new Date().toISOString() });
  if (error) redirect("/configuracion?error=" + encodeURIComponent(error.message));
  revalidatePath("/configuracion");
  redirect("/configuracion?ok=" + encodeURIComponent("Datos del negocio guardados"));
}

export async function guardarAlertas(formData: FormData) {
  const supabase = await createClient();
  const emails = String(formData.get("emails") ?? "")
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const valor = { emails, activo: formData.get("activo") === "on" };
  const { error } = await supabase.from("configuracion").upsert({ clave: "alertas_stock", valor, actualizado_en: new Date().toISOString() });
  if (error) redirect("/configuracion?error=" + encodeURIComponent(error.message));
  revalidatePath("/configuracion");
  redirect("/configuracion?ok=" + encodeURIComponent(`Alertas guardadas (${emails.length} destinatario/s)`));
}

export async function actualizarUsuario(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({ rol: String(formData.get("rol")), activo: formData.get("activo") === "on" })
    .eq("id", id);
  if (error) redirect("/configuracion?error=" + encodeURIComponent(error.message));
  revalidatePath("/configuracion");
  redirect("/configuracion?ok=" + encodeURIComponent("Usuario actualizado"));
}

export async function enviarAlertaAhora() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/cron/stock-bajo?force=1`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) redirect("/configuracion?error=" + encodeURIComponent(json.error ?? "Error al enviar"));
    redirect("/configuracion?ok=" + encodeURIComponent(json.mensaje ?? "Enviado"));
  } catch (e) {
    if ((e as Error & { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect("/configuracion?error=" + encodeURIComponent("No se pudo llamar al endpoint de alertas: " + (e as Error).message));
  }
}

export async function guardarUnidad(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const datos = {
    nombre: String(formData.get("nombre") ?? "").trim(),
    color: String(formData.get("color") ?? "#1f5eff"),
    orden: parseInt(String(formData.get("orden") ?? "0"), 10) || 0,
    activo: formData.get("activo") === "on",
  };
  if (!datos.nombre) redirect("/configuracion?error=" + encodeURIComponent("La unidad necesita un nombre"));
  const { error } = id
    ? await supabase.from("unidades_negocio").update(datos).eq("id", id)
    : await supabase.from("unidades_negocio").insert({ ...datos, activo: true });
  if (error) redirect("/configuracion?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/configuracion?ok=" + encodeURIComponent("Unidad de negocio guardada"));
}

export async function recalcularUnidadesRemitos() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recalcular_unidades_remitos");
  if (error) redirect("/configuracion?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/configuracion?ok=" + encodeURIComponent(`Listo: ${data} renglón/es de remitos viejos tomaron la unidad de su producto y se rearmó la cuenta corriente`));
}
