import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import FiltroUnidad from "@/components/FiltroUnidad";
import UnidadBadge from "@/components/UnidadBadge";
import EstadoPagoBadge from "@/components/EstadoPagoBadge";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda, formatoFecha, numeroRemito } from "@/lib/utils";
import type { RemitoSaldo } from "@/lib/types";

export default async function RemitosPage({ searchParams }: { searchParams: Promise<{ q?: string; desde?: string; hasta?: string; unidad?: string; pendientes?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const unidades = await getUnidades(supabase, false);
  let query = supabase.from("remitos_saldo").select("*, clientes!inner(nombre)").order("numero", { ascending: false }).limit(300);
  if (sp.q) query = query.ilike("clientes.nombre", `%${sp.q}%`);
  if (sp.desde) query = query.gte("fecha", sp.desde);
  if (sp.hasta) query = query.lte("fecha", sp.hasta);
  if (sp.unidad) query = query.eq("unidad_negocio_id", sp.unidad);
  if (sp.pendientes) query = query.gt("saldo", 0);
  const { data } = await query;
  const remitos = (data ?? []) as (RemitoSaldo & { clientes: { nombre: string } })[];
  const totalPendiente = remitos.reduce((a, r) => a + Number(r.saldo), 0);

  return (
    <>
      <PageHeader titulo="Remitos" subtitulo={`${remitos.length} remitos · pendiente de cobro en este listado: ${formatoMoneda(totalPendiente)}`}>
        <Link href="/remitos/nuevo" className="btn btn-primary">+ Nuevo remito</Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FiltroUnidad unidades={unidades} actual={sp.unidad} base="/remitos" extra={{ q: sp.q, desde: sp.desde, hasta: sp.hasta, pendientes: sp.pendientes }} />
        <form className="flex flex-wrap gap-2 no-print">
          {sp.unidad && <input type="hidden" name="unidad" value={sp.unidad} />}
          <input className="input max-w-xs" name="q" placeholder="Cliente…" defaultValue={sp.q ?? ""} />
          <input className="input" style={{ width: 160 }} type="date" name="desde" defaultValue={sp.desde ?? ""} />
          <input className="input" style={{ width: 160 }} type="date" name="hasta" defaultValue={sp.hasta ?? ""} />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="pendientes" value="1" defaultChecked={!!sp.pendientes} /> solo con saldo</label>
          <button className="btn btn-secondary">Filtrar</button>
        </form>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Unidad</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Pendiente</th><th>Estado</th></tr></thead>
          <tbody>
            {remitos.map((r) => (
              <tr key={r.id}>
                <td><Link className="underline font-medium" href={`/remitos/${r.id}`}>{numeroRemito(r.numero)}</Link></td>
                <td>{formatoFecha(r.fecha)}</td>
                <td><Link className="underline" href={`/clientes/${r.cliente_id}`}>{r.clientes.nombre}</Link></td>
                <td><UnidadBadge unidades={unidades} id={r.unidad_negocio_id} /></td>
                <td className="num">{formatoMoneda(r.total)}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{Number(r.pagado) ? formatoMoneda(r.pagado) : ""}</td>
                <td className="num font-semibold" style={{ color: Number(r.saldo) > 0 ? "var(--warn)" : undefined }}>{Number(r.saldo) > 0 ? formatoMoneda(r.saldo) : ""}</td>
                <td><EstadoPagoBadge estado={r.estado_pago} /></td>
              </tr>
            ))}
            {!remitos.length && <tr><td colSpan={8} style={{ color: "var(--muted)" }}>No hay remitos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
