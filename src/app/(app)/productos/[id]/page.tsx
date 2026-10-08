import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import ProductoForm from "@/components/ProductoForm";
import SubmitButton from "@/components/SubmitButton";
import { actualizarProducto, ajustarStock } from "@/lib/actions/productos";
import { createClient } from "@/lib/supabase/server";
import { formatoNumero, formatoFecha } from "@/lib/utils";
import { getUnidades } from "@/lib/unidades";

export default async function ProductoDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: producto }, { data: movimientos }, unidades] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).single(),
    supabase.from("movimientos_stock").select("*").eq("producto_id", id).order("creado_en", { ascending: false }).limit(30),
    getUnidades(supabase, false),
  ]);
  if (!producto) notFound();
  const bajo = producto.alerta_stock && Number(producto.stock) <= Number(producto.stock_minimo);

  return (
    <>
      <PageHeader titulo={producto.nombre} subtitulo={producto.codigo ? `Código ${producto.codigo}` : undefined}>
        <Link href="/productos" className="btn btn-secondary">← Volver</Link>
      </PageHeader>
      <Mensaje error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProductoForm action={actualizarProducto.bind(null, id)} producto={producto} unidades={unidades} />
        </div>
        <div className="space-y-4">
          <div className="card" id="stock">
            <div className="label">Stock actual</div>
            <div className="text-3xl font-bold" style={{ color: bajo ? "var(--danger)" : "var(--ok)" }}>
              {formatoNumero(producto.stock)} <span className="text-base font-normal">{producto.unidad}</span>
            </div>
            {bajo && <div className="badge badge-danger mt-1">por debajo del mínimo ({formatoNumero(producto.stock_minimo)})</div>}

            <form action={ajustarStock.bind(null, id)} className="mt-4 space-y-3">
              <div>
                <label className="label">Movimiento</label>
                <select className="select" name="tipo" defaultValue="compra">
                  <option value="compra">Compra / ingreso de mercadería</option>
                  <option value="ajuste">Ajuste de inventario</option>
                </select>
              </div>
              <div>
                <label className="label">Cantidad (negativo para restar)</label>
                <input className="input" name="cantidad" type="number" step="1" inputMode="numeric" required placeholder="Ej: 50 o -3" />
              </div>
              <div>
                <label className="label">Detalle</label>
                <input className="input" name="descripcion" placeholder="Proveedor, motivo…" />
              </div>
              <SubmitButton className="btn btn-secondary w-full justify-center">Aplicar movimiento</SubmitButton>
            </form>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">Últimos movimientos</h3>
            <table className="table">
              <tbody>
                {(movimientos ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs" style={{ color: "var(--muted)" }}>{formatoFecha(m.creado_en)}</td>
                    <td className="text-sm">
                      {m.referencia_id && (m.tipo === "remito" || m.tipo === "anulacion_remito")
                        ? <Link className="underline" href={`/remitos/${m.referencia_id}`}>{m.descripcion}</Link>
                        : m.descripcion}
                    </td>
                    <td className="num font-semibold" style={{ color: Number(m.cantidad) < 0 ? "var(--danger)" : "var(--ok)" }}>
                      {Number(m.cantidad) > 0 ? "+" : ""}{formatoNumero(m.cantidad)}
                    </td>
                  </tr>
                ))}
                {!movimientos?.length && <tr><td style={{ color: "var(--muted)" }}>Sin movimientos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
