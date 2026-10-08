import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import FiltroUnidad from "@/components/FiltroUnidad";
import SeleccionMasiva from "@/components/SeleccionMasiva";
import BusquedaViva from "@/components/BusquedaViva";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import type { Producto } from "@/lib/types";

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string; todos?: string; bajo?: string; unidad?: string; sinunidad?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const unidades = await getUnidades(supabase, false);
  let query = supabase.from("productos").select("*").order("nombre").limit(2000);
  if (!sp.todos) query = query.eq("activo", true);
  if (sp.q) query = query.or(`nombre.ilike.%${sp.q}%,codigo.ilike.%${sp.q}%,categoria.ilike.%${sp.q}%`);
  if (sp.unidad) query = query.eq("unidad_negocio_id", sp.unidad);
  if (sp.sinunidad) query = query.is("unidad_negocio_id", null);
  const { data } = await query;
  let productos = (data ?? []) as Producto[];
  if (sp.bajo) productos = productos.filter((p) => p.alerta_stock && Number(p.stock) <= Number(p.stock_minimo));
  const { count: sinUnidad } = await supabase.from("productos").select("id", { count: "exact", head: true }).is("unidad_negocio_id", null).eq("activo", true);

  const qs = new URLSearchParams();
  Object.entries({ q: sp.q, todos: sp.todos, bajo: sp.bajo, unidad: sp.unidad, sinunidad: sp.sinunidad }).forEach(([k, v]) => { if (v) qs.set(k, v); });
  const volver = "/productos" + (qs.toString() ? "?" + qs.toString() : "");

  return (
    <>
      <PageHeader titulo="Productos" subtitulo={`${productos.length} productos`}>
        <Link href="/productos/nuevo" className="btn btn-primary">+ Nuevo producto</Link>
      </PageHeader>
      <Mensaje ok={sp.ok} error={sp.error} />
      {(sinUnidad ?? 0) > 0 && !sp.sinunidad && (
        <div className="alert-error mb-4">
          Hay <strong>{sinUnidad}</strong> productos sin unidad de negocio asignada. <Link className="underline" href="/productos?sinunidad=1">Ver y asignar</Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FiltroUnidad unidades={unidades} actual={sp.unidad} base="/productos" extra={{ q: sp.q, todos: sp.todos, bajo: sp.bajo }} />
        <BusquedaViva placeholder="Nombre, código o categoría…" />
        <form className="flex flex-wrap gap-3 items-center no-print">
          {sp.unidad && <input type="hidden" name="unidad" value={sp.unidad} />}
          {sp.q && <input type="hidden" name="q" value={sp.q} />}
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="sinunidad" value="1" defaultChecked={!!sp.sinunidad} /> sin unidad</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="bajo" value="1" defaultChecked={!!sp.bajo} /> stock bajo</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="todos" value="1" defaultChecked={!!sp.todos} /> inactivos</label>
          <button className="btn btn-secondary btn-sm">Aplicar</button>
        </form>
      </div>

      <SeleccionMasiva productos={productos} unidades={unidades} volver={volver} />
    </>
  );
}
