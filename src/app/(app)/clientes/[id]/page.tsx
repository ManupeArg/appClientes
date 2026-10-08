import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import FiltroUnidad from "@/components/FiltroUnidad";
import UnidadBadge from "@/components/UnidadBadge";
import EstadoPagoBadge from "@/components/EstadoPagoBadge";
import { createClient } from "@/lib/supabase/server";
import { anularPago } from "@/lib/actions/pagos";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda, formatoFecha, numeroRemito } from "@/lib/utils";
import type { MovimientoCC, RemitoSaldo } from "@/lib/types";

export default async function ClienteDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string; unidad?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: cliente }, { data: movimientos }, { data: remitosData }, { data: saldosUnidad }, unidades] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("cuenta_corriente").select("*").eq("cliente_id", id).order("fecha").order("creado_en"),
    supabase.from("remitos_saldo").select("*").eq("cliente_id", id).order("numero", { ascending: false }),
    supabase.from("saldos_clientes_unidad").select("*").eq("cliente_id", id),
    getUnidades(supabase, false),
  ]);
  if (!cliente) notFound();

  const todosMov = (movimientos ?? []) as MovimientoCC[];
  const movs = sp.unidad ? todosMov.filter((m) => m.unidad_negocio_id === sp.unidad) : todosMov;
  let saldo = 0;
  const filas = movs.map((m) => {
    saldo += Number(m.debe) - Number(m.haber);
    return { ...m, saldo };
  });
  const totalDebe = filas.reduce((a, m) => a + Number(m.debe), 0);
  const totalHaber = filas.reduce((a, m) => a + Number(m.haber), 0);
  const remitos = ((remitosData ?? []) as RemitoSaldo[]).filter((r) => !sp.unidad || r.unidad_negocio_id === sp.unidad);
  const saldoTotal = todosMov.reduce((a, m) => a + Number(m.debe) - Number(m.haber), 0);
  const saldoDe = (uid: string | null) => Number((saldosUnidad ?? []).find((s) => (s.unidad_negocio_id ?? null) === uid)?.saldo ?? 0);
  const saldoSinUnidad = saldoDe(null);

  return (
    <>
      <PageHeader titulo={cliente.nombre} subtitulo={[cliente.localidad, cliente.telefono, cliente.email].filter(Boolean).join(" · ")}>
        <Link href={`/remitos/nuevo?cliente=${id}${sp.unidad ? `&unidad=${sp.unidad}` : ""}`} className="btn btn-primary">+ Remito</Link>
        <Link href={`/pagos/nuevo?cliente=${id}`} className="btn btn-secondary">+ Pago</Link>
        <Link href={`/clientes/${id}/editar`} className="btn btn-secondary">Editar</Link>
      </PageHeader>
      <Mensaje error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {unidades.map((u) => {
          const s = saldoDe(u.id);
          return (
            <div key={u.id} className="card" style={{ borderTop: `3px solid ${u.color}` }}>
              <div className="label">Saldo {u.nombre}</div>
              <div className="text-xl font-bold" style={{ color: s > 0 ? "var(--warn)" : s < 0 ? "var(--ok)" : undefined }}>{formatoMoneda(s)}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{s > 0 ? "debe" : s < 0 ? "a favor" : "al día"}</div>
            </div>
          );
        })}
        {saldoSinUnidad !== 0 && (
          <div className="card">
            <div className="label">Sin unidad (pagos a cuenta)</div>
            <div className="text-xl font-bold">{formatoMoneda(saldoSinUnidad)}</div>
          </div>
        )}
        <div className="card" style={{ background: "#141c2e", color: "#fff", borderColor: "#141c2e" }}>
          <div className="label" style={{ color: "#8a97b3" }}>Saldo total</div>
          <div className="text-xl font-bold">{formatoMoneda(saldoTotal)}</div>
          <div className="text-xs" style={{ color: "#8a97b3" }}>lista {cliente.tipo_precio}</div>
        </div>
      </div>

      {cliente.notas && <div className="card mb-4 text-sm whitespace-pre-wrap">{cliente.notas}</div>}

      <div className="mb-4"><FiltroUnidad unidades={unidades} actual={sp.unidad} base={`/clientes/${id}`} /></div>

      <h2 className="font-semibold mb-2">Remitos</h2>
      <div className="card p-0 overflow-x-auto mb-6">
        <table className="table">
          <thead><tr><th>N°</th><th>Fecha</th><th>Unidad</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Pendiente</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {remitos.map((r) => (
              <tr key={r.id}>
                <td><Link className="underline font-medium" href={`/remitos/${r.id}`}>{numeroRemito(r.numero)}</Link></td>
                <td>{formatoFecha(r.fecha)}</td>
                <td><UnidadBadge unidades={unidades} id={r.unidad_negocio_id} /></td>
                <td className="num">{formatoMoneda(r.total)}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{Number(r.pagado) ? formatoMoneda(r.pagado) : ""}</td>
                <td className="num font-semibold" style={{ color: Number(r.saldo) > 0 ? "var(--warn)" : undefined }}>{Number(r.saldo) > 0 ? formatoMoneda(r.saldo) : ""}</td>
                <td><EstadoPagoBadge estado={r.estado_pago} /></td>
                <td className="text-right no-print">
                  {r.estado === "emitido" && Number(r.saldo) > 0 && <Link className="btn btn-secondary btn-sm" href={`/pagos/nuevo?remito=${r.id}`}>Pagar</Link>}
                </td>
              </tr>
            ))}
            {!remitos.length && <tr><td colSpan={8} style={{ color: "var(--muted)" }}>Sin remitos.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold mb-2">Cuenta corriente {sp.unidad ? `· ${unidades.find((u) => u.id === sp.unidad)?.nombre ?? ""}` : ""}</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Fecha</th><th>Concepto</th><th>Unidad</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.id}>
                <td>{formatoFecha(m.fecha)}</td>
                <td>
                  {m.remito_id ? (
                    <Link className="underline" href={`/remitos/${m.remito_id}`}>{m.descripcion.replace(/[Rr]emito N° (\d+)/, (_, n) => "remito " + numeroRemito(Number(n)))}</Link>
                  ) : m.descripcion}
                  {(m.tipo === "anulacion_remito" || m.tipo === "anulacion_pago") && <span className="badge badge-danger ml-2">anulación</span>}
                </td>
                <td><UnidadBadge unidades={unidades} id={m.unidad_negocio_id} /></td>
                <td className="num">{Number(m.debe) ? formatoMoneda(m.debe) : ""}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{Number(m.haber) ? formatoMoneda(m.haber) : ""}</td>
                <td className="num font-semibold">{formatoMoneda(m.saldo)}</td>
                <td className="text-right no-print">
                  {m.tipo === "pago" && m.pago_id && (
                    <form action={anularPago.bind(null, m.pago_id, `/clientes/${id}`)}>
                      <button className="btn btn-danger btn-sm" type="submit">Anular</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!filas.length && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>Sin movimientos todavía.</td></tr>}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="font-semibold">Totales</td>
                <td className="num font-semibold">{formatoMoneda(totalDebe)}</td>
                <td className="num font-semibold">{formatoMoneda(totalHaber)}</td>
                <td className="num font-bold">{formatoMoneda(totalDebe - totalHaber)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
        Debe = remitos entregados · Haber = pagos recibidos · Saldo positivo = el cliente te debe.
      </p>
    </>
  );
}
