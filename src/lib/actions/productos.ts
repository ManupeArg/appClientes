"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null, def = 0) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
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
    stock_minimo: num(formData.get("stock_minimo")),
    alerta_stock: formData.get("alerta_stock") === "on",
    activo: formData.get("activo") !== "off",
  };
}

export async function crearProducto(formData: FormData) {
  const supabase = await createClient();
  const datos = datosProducto(formData);
  if (!datos.nombre) redirect("/productos/nuevo?error=" + encodeURIComponent("El nombre es obligatorio"));
  const stockInicial = num(formData.get("stock"));
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
  const { error } = await supabase.from("productos").update(datos).eq("id", id);
  if (error) redirect(`/productos/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath("/productos");
  redirect(`/productos/${id}?ok=` + encodeURIComponent("Producto actualizado"));
}

export async function ajustarStock(id: string, formData: FormData) {
  const supabase = await createClient();
  const cantidad = num(formData.get("cantidad"));
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
