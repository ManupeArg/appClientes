import Link from "next/link";
import { notFound } from "next/navigation";
import Mensaje from "@/components/Mensaje";
import BotonImprimir from "@/components/BotonImprimir";
import { createClient } from "@/lib/supabase/server";
import { anularRemito } from "@/lib/actions/remitos";
import { formatoMoneda, formatoNumero, formatoFecha, numeroRemito } from "@/lib/utils";

export default async function RemitoDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: remito }, { data: items }, { data: config }] = await Promise.all([
    supabase.from("remitos").select("*, clientes(*)").eq("id", id).single(),
    supabase.from("remito_items").select("*, productos(codigo, unidad)").eq("remito_id", id).order("descripcion"),
    supabase.from("configuracion").select("valor").eq("clave", "negocio").single(),
  ]);
  if (!remito) notFound();
  const cliente = remito.clientes as { nombre: string; cuit: string | null; direccion: string | null; localidad: string | null; telefono: string | null };
  const negocio = (config?.valor ?? {}) as { nombre?: string; cuit?: string; direccion?: string; telefono?: string; email?: string };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <div className="flex gap-2">
          <Link href="/remitos" className="btn btn-secondary">← Remitos</Link>
          <Link href={`/clientes/${remito.cliente_id}`} className="btn btn-secondary">Cuenta corriente</Link>
        </div>
        <div className="flex gap-2">
          <BotonImprimir />
          {remito.estado === "emitido" && (
            <form action={anularRemito.bind(null, id)}>
              <button className="btn btn-danger" type="submit">Anular remito</button>
            </form>
          )}
        </div>
      </div>
      <Mensaje error={sp.error} ok={sp.ok} />

      <div className="card max-w-3xl mx-auto" style={{ padding: "2rem" }}>
        <div className="flex justify-between items-start border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="text-2xl font-black" style={{ color: "var(--primary)" }}>{negocio.nombre || "MSP"}</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {negocio.cuit && <div>CUIT {negocio.cuit}</div>}
              {negocio.direccion && <div>{negocio.direccion}</div>}
              {(negocio.telefono || negocio.email) && <div>{[negocio.telefono, negocio.email].filter(Boolean).join(" · ")}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase font-bold tracking-wide" style={{ color: "var(--muted)" }}>Remito</div>
            <div className="text-2xl font-bold">{numeroRemito(remito.numero)}</div>
            <div className="text-sm">{formatoFecha(remito.fecha)}</div>
            {remito.estado === "anulado" && <div className="badge badge-danger mt-1">ANULADO</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <div className="label">Cliente</div>
            <div className="font-semibold text-base">{cliente.nombre}</div>
            {cliente.cuit && <div>CUIT/DNI: {cliente.cuit}</div>}
            {(cliente.direccion || cliente.localidad) && <div>{[cliente.direccion, cliente.localidad].filter(Boolean).join(", ")}</div>}
            {cliente.telefono && <div>Tel: {cliente.telefono}</div>}
          </div>
          <div className="text-right">
            <div className="label">Lista de precios</div>
            <div className="capitalize">{remito.tipo_precio}</div>
          </div>
        </div>

        <table className="table mb-4">
          <thead>
            <tr><th>Código</th><th>Descripción</th><th className="num">Cant.</th><th className="num">P. unitario</th><th className="num">Subtotal</th></tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => {
              const prod = it.productos as unknown as { codigo: string | null; unidad: string } | null;
              return (
                <tr key={it.id}>
                  <td className="text-xs" style={{ color: "var(--muted)" }}>{prod?.codigo}</td>
                  <td>{it.descripcion}</td>
                  <td className="num">{formatoNumero(it.cantidad)} {prod?.unidad}</td>
                  <td className="num">{formatoMoneda(it.precio_unitario)}</td>
                  <td className="num">{formatoMoneda(it.subtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatoMoneda(remito.subtotal)}</span></div>
            {Number(remito.descuento) > 0 && <div className="flex justify-between"><span>Descuento</span><span>- {formatoMoneda(remito.descuento)}</span></div>}
            <div className="flex justify-between text-lg font-bold border-t pt-1" style={{ borderColor: "var(--border)" }}><span>Total</span><span>{formatoMoneda(remito.total)}</span></div>
          </div>
        </div>

        {remito.observaciones && (
          <div className="mt-6 text-sm">
            <div className="label">Observaciones</div>
            <div className="whitespace-pre-wrap">{remito.observaciones}</div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs" style={{ color: "var(--muted)" }}>
          <div className="border-t pt-2" style={{ borderColor: "var(--border)" }}>Entregó</div>
          <div className="border-t pt-2" style={{ borderColor: "var(--border)" }}>Recibí conforme</div>
        </div>
        <p className="mt-6 text-center text-xs" style={{ color: "var(--muted)" }}>Documento no válido como factura.</p>
      </div>
    </>
  );
}
