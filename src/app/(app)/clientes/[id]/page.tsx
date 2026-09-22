import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import { createClient } from "@/lib/supabase/server";
import { anularPago } from "@/lib/actions/pagos";
import { formatoMoneda, formatoFecha, numeroRemito } from "@/lib/utils";
import type { MovimientoCC } from "@/lib/types";

export default async function ClienteDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: cliente }, { data: movimientos }, { data: remitos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("cuenta_corriente").select("*").eq("cliente_id", id).order("fecha").order("creado_en"),
    supabase.from("remitos").select("id, numero").eq("cliente_id", id),
  ]);
  if (!cliente) notFound();

  const numeros = new Map((remitos ?? []).map((r) => [r.id, r.numero]));
  let saldo = 0;
  const filas = ((movimientos ?? []) as MovimientoCC[]).map((m) => {
    saldo += Number(m.debe) - Number(m.haber);
    return { ...m, saldo };
  });
  const totalDebe = filas.reduce((a, m) => a + Number(m.debe), 0);
  const totalHaber = filas.reduce((a, m) => a + Number(m.haber), 0);

  return (
    <>
      <PageHeader titulo={cliente.nombre} subtitulo={[cliente.localidad, cliente.telefono, cliente.email].filter(Boolean).join(" · ")}>
        <Link href={`/remitos/nuevo?cliente=${id}`} className="btn btn-primary">+ Remito</Link>
        <Link href={`/pagos/nuevo?cliente=${id}`} className="btn btn-secondary">+ Pago</Link>
        <Link href={`/clientes/${id}/editar`} className="btn btn-secondary">Editar</Link>
      </PageHeader>
      <Mensaje error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card"><div className="label">Lista de precios</div><div className="font-semibold capitalize">{cliente.tipo_precio}</div></div>
        <div className="card"><div className="label">Total comprado</div><div className="font-semibold">{formatoMoneda(totalDebe)}</div></div>
        <div className="card"><div className="label">Total pagado</div><div className="font-semibold">{formatoMoneda(totalHaber)}</div></div>
        <div className="card">
          <div className="label">Saldo actual</div>
          <div className="text-xl font-bold" style={{ color: saldo > 0 ? "var(--warn)" : saldo < 0 ? "var(--ok)" : undefined }}>{formatoMoneda(saldo)}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{saldo > 0 ? "el cliente debe" : saldo < 0 ? "saldo a favor del cliente" : "al día"}</div>
        </div>
      </div>

      {cliente.notas && <div className="card mb-6 text-sm whitespace-pre-wrap">{cliente.notas}</div>}

      <h2 className="font-semibold mb-2">Cuenta corriente</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Fecha</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.id}>
                <td>{formatoFecha(m.fecha)}</td>
                <td>
                  {m.remito_id ? (
                    <Link className="underline" href={`/remitos/${m.remito_id}`}>{m.descripcion.replace(/Remito N° (\d+)/, (_, n) => "Remito " + numeroRemito(Number(n)))}</Link>
                  ) : m.descripcion}
                  {(m.tipo === "anulacion_remito" || m.tipo === "anulacion_pago") && <span className="badge badge-danger ml-2">anulación</span>}
                </td>
                <td className="num">{Number(m.debe) ? formatoMoneda(m.debe) : ""}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{Number(m.haber) ? formatoMoneda(m.haber) : ""}</td>
                <td className="num font-semibold">{formatoMoneda(m.saldo)}</td>
                <td className="text-right no-print">
                  {m.tipo === "pago" && m.pago_id && (
                    <form action={anularPago.bind(null, m.pago_id, id)}>
                      <button className="btn btn-danger btn-sm" type="submit">Anular</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!filas.length && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>Sin movimientos todavía.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
        Debe = remitos entregados · Haber = pagos recibidos · Saldo positivo = el cliente te debe. {numeros.size} remitos en total.
      </p>
    </>
  );
}
