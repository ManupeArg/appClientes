"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function vacioANull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function datosCliente(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    cuit: vacioANull(formData.get("cuit")),
    telefono: vacioANull(formData.get("telefono")),
    email: vacioANull(formData.get("email")),
    direccion: vacioANull(formData.get("direccion")),
    localidad: vacioANull(formData.get("localidad")),
    tipo_precio: String(formData.get("tipo_precio") ?? "minorista"),
    plazo_dias: Math.max(0, parseInt(String(formData.get("plazo_dias") ?? "0"), 10) || 0),
    notas: vacioANull(formData.get("notas")),
    activo: formData.has("activo") ? formData.getAll("activo").includes("on") : true,
  };
}

export async function crearCliente(formData: FormData) {
  const supabase = await createClient();
  const datos = datosCliente(formData);
  if (!datos.nombre) redirect("/clientes/nuevo?error=" + encodeURIComponent("El nombre es obligatorio"));
  const { data, error } = await supabase.from("clientes").insert(datos).select("id").single();
  if (error) redirect("/clientes/nuevo?error=" + encodeURIComponent(error.message));
  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function actualizarCliente(id: string, formData: FormData) {
  const supabase = await createClient();
  const datos = datosCliente(formData);
  if (!datos.nombre) redirect(`/clientes/${id}/editar?error=` + encodeURIComponent("El nombre es obligatorio"));
  const { error } = await supabase.from("clientes").update(datos).eq("id", id);
  if (error) redirect(`/clientes/${id}/editar?error=` + encodeURIComponent(error.message));
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}
