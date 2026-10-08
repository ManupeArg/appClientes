import Link from "next/link";
import { notFound } from "next/navigation";
import Mensaje from "@/components/Mensaje";
import BotonImprimir from "@/components/BotonImprimir";
import EstadoPagoBadge from "@/components/EstadoPagoBadge";
import { createClient } from "@/lib/supabase/server";
import { anularRemito } from "@/lib/actions/remitos";
import { quitarImputacion } from "@/lib/actions/pagos";
import { getUnidades } from "@/lib/unidades";
import UnidadesChips from "@/components/UnidadesChips";
import { formatoMoneda, formatoNumero, formatoFecha, numeroRemito } from "@/lib/utils";
import type { RemitoSaldo, RemitoUnidad } from "@/lib/types";

export default async function RemitoDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: remitoData }, { data: items }, { data: config }, { data: imputData }, unidades, { data: partesData }] = await Promise.all([
    supabase.from("remitos_saldo").select("*, clientes(*)").eq("id", id).single(),
    supabase.from("remito_items").select("*, productos(codigo, unidad)").eq("remito_id", id).order("descripcion"),
    supabase.from("configuracion").select("valor").eq("clave", "negocio").single(),
    supabase.from("pago_imputaciones").select("*, pagos(fecha, medio, referencia, observaciones, monto, anulado)").eq("remito_id", id).order("creado_en"),
    getUnidades(supabase, false),
    supabase.from("remito_unidades").select("*").eq("remito_id", id),
  ]);
  if (!remitoData) notFound();
  const partes = (partesData ?? []) as RemitoUnidad[];
  const remito = remitoData as RemitoSaldo & { clientes: { nombre: string; cuit: string | null; direccion: string | null; localidad: string | null; telefono: string | null } };
  const cliente = remito.clientes;
  type Imput = { id: string; pago_id: string; monto: number; pagos: { fecha: string; medio: string; referencia: string | null; observaciones: string | null; monto: number; anulado: boolean } };
  const imputaciones = (imputData ?? []) as unknown as Imput[];
  const vigentes = imputaciones.filter((i) => !i.pagos.anulado);
  const negocio = (config?.valor ?? {}) as { nombre?: string; cuit?: string; direccion?: string; telefono?: string; email?: string };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <div className="flex gap-2">
          <Link href="/remitos" className="btn btn-secondary">← Remitos</Link>
          <Link href={`/clientes/${remito.cliente_id}`} className="btn btn-secondary">Cuenta corriente</Link>
        </div>
        <div className="flex gap-2">
          {remito.estado === "emitido" && Number(remito.saldo) > 0 && (
            <Link href={`/pagos/nuevo?remito=${id}`} className="btn btn-primary">+ Registrar pago</Link>
          )}
          <BotonImprimir />
          {remito.estado === "emitido" && vigentes.length === 0 && (
            <form action={anularRemito.bind(null, id)}>
              <button className="btn btn-danger" type="submit">Anular remito</button>
            </form>
          )}
        </div>
      </div>
      <Mensaje error={sp.error} ok={sp.ok} />

      {remito.estado === "emitido" && (
        <div className="card max-w-3xl mx-auto mb-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <EstadoPagoBadge estado={remito.estado_pago} />
              <span className="text-sm">Pagado <strong>{formatoMoneda(remito.pagado)}</strong> · Pendiente <strong style={{ color: Number(remito.saldo) > 0 ? "var(--warn)" : "var(--ok)" }}>{formatoMoneda(remito.saldo)}</strong></span>
            </div>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {remito.vencimiento ? `Vence ${formatoFecha(remito.vencimiento)}` : "Sin plazo"}{remito.vencido && <span className="badge badge-danger ml-2">vencido</span>}
              {vigentes.length > 0 && " · Para anular el remito, primero quitá las imputaciones."}
            </span>
          </div>
          {imputaciones.length > 0 && (
            <table className="table mt-3">
              <thead><tr><th>Pago</th><th>Medio</th><th>Referencia</th><th className="num">Imputado a este remito</th><th></th></tr></thead>
              <tbody>
                {imputaciones.map((i) => (
                  <tr key={i.id} style={{ opacity: i.pagos.anulado ? 0.5 : 1 }}>
                    <td>{formatoFecha(i.pagos.fecha)} <span className="text-xs" style={{ color: "var(--muted)" }}>(pago de {formatoMoneda(i.pagos.monto)})</span></td>
                    <td className="capitalize">{i.pagos.medio}</td>
                    <td className="text-sm">{i.pagos.referencia}{i.pagos.observaciones ? ` · ${i.pagos.observaciones}` : ""}</td>
                    <td className="num font-semibold">{formatoMoneda(i.monto)}</td>
                    <td className="text-right">
                      {i.pagos.anulado ? <span className="badge badge-danger">pago anulado</span> : (
                        <form action={quitarImputacion.bind(null, i.id, `/remitos/${id}`)}>
                          <button className="btn btn-danger btn-sm" type="submit" title="El importe vuelve a quedar a cuenta del cliente">Quitar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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
            {remito.vencimiento && <div className="text-xs" style={{ color: "var(--muted)" }}>Vence {formatoFecha(remito.vencimiento)}</div>}
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
            <tr><th>Código</th><th>Descripción</th><th className="no-print">Unidad</th><th className="num">Cant.</th><th className="num">P. unitario</th><th className="num">Subtotal</th></tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => {
              const prod = it.productos as unknown as { codigo: string | null; unidad: string } | null;
              return (
                <tr key={it.id}>
                  <td className="text-xs" style={{ color: "var(--muted)" }}>{prod?.codigo}</td>
                  <td>{it.descripcion}</td>
                  <td className="no-print text-xs" style={{ color: "var(--muted)" }}>{unidades.find((u) => u.id === it.unidad_negocio_id)?.nombre ?? "—"}</td>
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
            {partes.length > 0 && (
              <div className="no-print pt-2 text-right"><UnidadesChips unidades={unidades} partes={partes} /></div>
            )}
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
