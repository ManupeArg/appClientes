"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null, def = 0) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? def : n;
}
function entero(v: FormDataEntryValue | null, def = 0) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return isNaN(n) ? def : n;
}
function vacioANull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function datosProducto(formData: FormData) {
  return {
    codigo: vacioANull(formData.get("codigo")),
    nombre: String(formData.get("nombre") ?? "").trim(),
    descripcion: vacioANull(formData.get("descripcion")),
    categoria: vacioANull(formData.get("categoria")),
    unidad: String(formData.get("unidad") ?? "u").trim() || "u",
    precio_minorista: num(formData.get("precio_minorista")),
    precio_mayorista: num(formData.get("precio_mayorista")),
    costo: formData.get("costo") ? num(formData.get("costo")) : null,
    stock_minimo: entero(formData.get("stock_minimo")),
    unidad_negocio_id: vacioANull(formData.get("unidad_negocio_id")),
    alerta_stock: formData.get("alerta_stock") === "on",
    activo: formData.has("activo") ? formData.getAll("activo").includes("on") : true,
  };
}

export async function crearProducto(formData: FormData) {
  const supabase = await createClient();
  const datos = datosProducto(formData);
  if (!datos.nombre) redirect("/productos/nuevo?error=" + encodeURIComponent("El nombre es obligatorio"));
  if (!datos.unidad_negocio_id) redirect("/productos/nuevo?error=" + encodeURIComponent("Elegí la unidad de negocio"));
  const stockInicial = entero(formData.get("stock"));
  const { data, error } = await supabase.from("productos").insert(datos).select("id").single();
  if (error) redirect("/productos/nuevo?error=" + encodeURIComponent(error.message));
  if (stockInicial !== 0) {
    await supabase.rpc("ajustar_stock", {
      p_producto_id: data.id,
      p_cantidad: stockInicial,
      p_tipo: "inicial",
      p_descripcion: "Stock inicial",
    });
  }
  revalidatePath("/productos");
  redirect("/productos?ok=" + encodeURIComponent("Producto creado"));
}

export async function actualizarProducto(id: string, formData: FormData) {
  const supabase = await createClient();
  const datos = datosProducto(formData);
  if (!datos.nombre) redirect(`/productos/${id}?error=` + encodeURIComponent("El nombre es obligatorio"));
  if (!datos.unidad_negocio_id) redirect(`/productos/${id}?error=` + encodeURIComponent("Elegí la unidad de negocio"));
  const { error } = await supabase.from("productos").update(datos).eq("id", id);
  if (error) redirect(`/productos/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath("/productos");
  redirect(`/productos/${id}?ok=` + encodeURIComponent("Producto actualizado"));
}

export async function ajustarStock(id: string, formData: FormData) {
  const supabase = await createClient();
  const cantidad = entero(formData.get("cantidad"));
  const tipo = String(formData.get("tipo") ?? "ajuste");
  const descripcion = String(formData.get("descripcion") ?? "").trim() || (tipo === "compra" ? "Compra / ingreso" : "Ajuste manual");
  if (cantidad === 0) redirect(`/productos/${id}?error=` + encodeURIComponent("La cantidad no puede ser 0"));
  const { error } = await supabase.rpc("ajustar_stock", {
    p_producto_id: id,
    p_cantidad: cantidad,
    p_tipo: tipo,
    p_descripcion: descripcion,
  });
  if (error) redirect(`/productos/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath("/productos");
  redirect(`/productos/${id}?ok=` + encodeURIComponent("Stock actualizado"));
}

export async function asignarUnidadMasivo(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const unidad = String(formData.get("unidad_negocio_id") ?? "");
  const volver = String(formData.get("volver") ?? "/productos");
  if (!ids.length) redirect(volver + (volver.includes("?") ? "&" : "?") + "error=" + encodeURIComponent("No seleccionaste ningún producto"));
  if (!unidad) redirect(volver + (volver.includes("?") ? "&" : "?") + "error=" + encodeURIComponent("Elegí la unidad de negocio a asignar"));
  const { data, error } = await supabase.rpc("asignar_unidad_productos", { p_ids: ids, p_unidad_negocio_id: unidad });
  if (error) redirect(volver + (volver.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(error.message));
  revalidatePath("/productos");
  redirect(volver + (volver.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent(`Unidad asignada a ${data} producto/s`));
}
