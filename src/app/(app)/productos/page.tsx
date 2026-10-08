import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import FiltroUnidad from "@/components/FiltroUnidad";
import UnidadBadge from "@/components/UnidadBadge";
import SeleccionMasiva from "@/components/SeleccionMasiva";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda, formatoNumero } from "@/lib/utils";
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
        <form className="flex flex-wrap gap-3 items-center no-print">
          {sp.unidad && <input type="hidden" name="unidad" value={sp.unidad} />}
          <input className="input max-w-sm" name="q" placeholder="Nombre, código o categoría…" defaultValue={sp.q ?? ""} />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="sinunidad" value="1" defaultChecked={!!sp.sinunidad} /> sin unidad</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="bajo" value="1" defaultChecked={!!sp.bajo} /> stock bajo</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="todos" value="1" defaultChecked={!!sp.todos} /> inactivos</label>
          <button className="btn btn-secondary">Filtrar</button>
        </form>
      </div>

      <SeleccionMasiva productos={productos} unidades={unidades} volver={volver}>
        {(sel, toggle) => (
          <div className="card p-0 overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th></th><th>Código</th><th>Producto</th><th>Unidad</th><th>Categoría</th><th className="num">Minorista</th><th className="num">Mayorista</th><th className="num">Stock</th><th className="num">Mínimo</th></tr>
              </thead>
              <tbody>
                {productos.map((p) => {
                  const bajo = p.alerta_stock && Number(p.stock) <= Number(p.stock_minimo);
                  return (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                      <td className="text-xs" style={{ color: "var(--muted)" }}>{p.codigo}</td>
                      <td className="font-medium">
                        <Link className="underline" href={`/productos/${p.id}`}>{p.nombre}</Link>
                        {!p.activo && <span className="badge badge-muted ml-2">inactivo</span>}
                      </td>
                      <td><UnidadBadge unidades={unidades} id={p.unidad_negocio_id} /></td>
                      <td>{p.categoria}</td>
                      <td className="num">{formatoMoneda(p.precio_minorista)}</td>
                      <td className="num">{formatoMoneda(p.precio_mayorista)}</td>
                      <td className="num font-semibold" style={{ color: bajo ? "var(--danger)" : undefined }}>
                        {formatoNumero(p.stock)} {p.unidad}
                        {bajo && <span className="badge badge-danger ml-2">bajo</span>}
                      </td>
                      <td className="num">{p.alerta_stock ? formatoNumero(p.stock_minimo) : <span style={{ color: "var(--muted)" }}>sin alerta</span>}</td>
                    </tr>
                  );
                })}
                {!productos.length && <tr><td colSpan={9} style={{ color: "var(--muted)" }}>No hay productos.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </SeleccionMasiva>
    </>
  );
}
