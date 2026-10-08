import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import FiltroUnidad from "@/components/FiltroUnidad";
import UnidadesChips from "@/components/UnidadesChips";
import EstadoPagoBadge from "@/components/EstadoPagoBadge";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda, formatoFecha, numeroRemito } from "@/lib/utils";
import type { RemitoSaldo, RemitoUnidad } from "@/lib/types";

export default async function RemitosPage({ searchParams }: { searchParams: Promise<{ q?: string; desde?: string; hasta?: string; unidad?: string; pendientes?: string; vencidos?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const unidades = await getUnidades(supabase, false);
  let query = supabase.from("remitos_saldo").select("*, clientes!inner(nombre)").order("numero", { ascending: false }).limit(300);
  if (sp.q) query = query.ilike("clientes.nombre", `%${sp.q}%`);
  if (sp.desde) query = query.gte("fecha", sp.desde);
  if (sp.hasta) query = query.lte("fecha", sp.hasta);
  if (sp.unidad) {
    const { data: ids } = await supabase.from("remito_unidades").select("remito_id").eq("unidad_negocio_id", sp.unidad);
    query = query.in("id", (ids ?? []).map((x) => x.remito_id));
  }
  if (sp.pendientes) query = query.gt("saldo", 0);
  if (sp.vencidos) query = query.eq("vencido", true);
  const { data } = await query;
  const remitos = (data ?? []) as (RemitoSaldo & { clientes: { nombre: string } })[];
  const { data: partesData } = await supabase.from("remito_unidades").select("*").in("remito_id", remitos.map((r) => r.id));
  const partes = (partesData ?? []) as RemitoUnidad[];
  const totalPendiente = remitos.reduce((a, r) => a + Number(r.saldo), 0);

  return (
    <>
      <PageHeader titulo="Remitos" subtitulo={`${remitos.length} remitos · pendiente de cobro en este listado: ${formatoMoneda(totalPendiente)}`}>
        <Link href="/remitos/nuevo" className="btn btn-primary">+ Nuevo remito</Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FiltroUnidad unidades={unidades} actual={sp.unidad} base="/remitos" extra={{ q: sp.q, desde: sp.desde, hasta: sp.hasta, pendientes: sp.pendientes, vencidos: sp.vencidos }} />
        <form className="flex flex-wrap gap-2 no-print">
          {sp.unidad && <input type="hidden" name="unidad" value={sp.unidad} />}
          <input className="input max-w-xs" name="q" placeholder="Cliente…" defaultValue={sp.q ?? ""} />
          <input className="input" style={{ width: 160 }} type="date" name="desde" defaultValue={sp.desde ?? ""} />
          <input className="input" style={{ width: 160 }} type="date" name="hasta" defaultValue={sp.hasta ?? ""} />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="pendientes" value="1" defaultChecked={!!sp.pendientes} /> solo con saldo</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="vencidos" value="1" defaultChecked={!!sp.vencidos} /> solo vencidos</label>
          <button className="btn btn-secondary">Filtrar</button>
        </form>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>N°</th><th>Fecha</th><th>Vence</th><th>Cliente</th><th>Unidades</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Pendiente</th><th>Estado</th></tr></thead>
          <tbody>
            {remitos.map((r) => (
              <tr key={r.id}>
                <td><Link className="underline font-medium" href={`/remitos/${r.id}`}>{numeroRemito(r.numero)}</Link></td>
                <td>{formatoFecha(r.fecha)}</td>
                <td>{r.vencimiento ? formatoFecha(r.vencimiento) : "—"}{r.vencido && <span className="badge badge-danger ml-1">vencido</span>}</td>
                <td><Link className="underline" href={`/clientes/${r.cliente_id}`}>{r.clientes.nombre}</Link></td>
                <td><UnidadesChips unidades={unidades} partes={partes.filter((p) => p.remito_id === r.id)} /></td>
                <td className="num">{formatoMoneda(r.total)}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{Number(r.pagado) ? formatoMoneda(r.pagado) : ""}</td>
                <td className="num font-semibold" style={{ color: Number(r.saldo) > 0 ? "var(--warn)" : undefined }}>{Number(r.saldo) > 0 ? formatoMoneda(r.saldo) : ""}</td>
                <td><EstadoPagoBadge estado={r.estado_pago} /></td>
              </tr>
            ))}
            {!remitos.length && <tr><td colSpan={9} style={{ color: "var(--muted)" }}>No hay remitos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
