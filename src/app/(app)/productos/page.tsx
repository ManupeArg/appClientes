import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import { createClient } from "@/lib/supabase/server";
import { formatoMoneda, formatoNumero } from "@/lib/utils";
import type { Producto } from "@/lib/types";

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; todos?: string; bajo?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("productos").select("*").order("nombre");
  if (!sp.todos) query = query.eq("activo", true);
  if (sp.q) query = query.or(`nombre.ilike.%${sp.q}%,codigo.ilike.%${sp.q}%,categoria.ilike.%${sp.q}%`);
  const { data } = await query;
  let productos = (data ?? []) as Producto[];
  if (sp.bajo) productos = productos.filter((p) => p.alerta_stock && Number(p.stock) <= Number(p.stock_minimo));

  return (
    <>
      <PageHeader titulo="Productos" subtitulo={`${productos.length} productos`}>
        <Link href="/productos/nuevo" className="btn btn-primary">+ Nuevo producto</Link>
      </PageHeader>
      <Mensaje ok={sp.ok} />
      <form className="flex flex-wrap gap-3 items-center mb-4 no-print">
        <input className="input max-w-sm" name="q" placeholder="Buscar por nombre, código o categoría…" defaultValue={sp.q ?? ""} />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="bajo" value="1" defaultChecked={!!sp.bajo} /> solo stock bajo</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="todos" value="1" defaultChecked={!!sp.todos} /> incluir inactivos</label>
        <button className="btn btn-secondary">Filtrar</button>
      </form>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Código</th><th>Producto</th><th>Categoría</th><th className="num">Minorista</th><th className="num">Mayorista</th><th className="num">Stock</th><th className="num">Mínimo</th><th></th></tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const bajo = p.alerta_stock && Number(p.stock) <= Number(p.stock_minimo);
              return (
                <tr key={p.id}>
                  <td className="text-xs" style={{ color: "var(--muted)" }}>{p.codigo}</td>
                  <td className="font-medium">
                    <Link className="underline" href={`/productos/${p.id}`}>{p.nombre}</Link>
                    {!p.activo && <span className="badge badge-muted ml-2">inactivo</span>}
                  </td>
                  <td>{p.categoria}</td>
                  <td className="num">{formatoMoneda(p.precio_minorista)}</td>
                  <td className="num">{formatoMoneda(p.precio_mayorista)}</td>
                  <td className="num font-semibold" style={{ color: bajo ? "var(--danger)" : undefined }}>
                    {formatoNumero(p.stock)} {p.unidad}
                    {bajo && <span className="badge badge-danger ml-2">bajo</span>}
                  </td>
                  <td className="num">{p.alerta_stock ? formatoNumero(p.stock_minimo) : <span style={{ color: "var(--muted)" }}>sin alerta</span>}</td>
                  <td className="text-right"><Link className="btn btn-secondary btn-sm" href={`/productos/${p.id}#stock`}>Stock</Link></td>
                </tr>
              );
            })}
            {!productos.length && <tr><td colSpan={8} style={{ color: "var(--muted)" }}>No hay productos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
