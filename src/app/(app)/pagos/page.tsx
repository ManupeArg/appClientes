import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import FiltroUnidad from "@/components/FiltroUnidad";
import UnidadBadge from "@/components/UnidadBadge";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda, formatoFecha, numeroRemito } from "@/lib/utils";

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ ok?: string; desde?: string; hasta?: string; unidad?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const unidades = await getUnidades(supabase, false);
  let query = supabase
    .from("pagos")
    .select("*, clientes(nombre), remitos(numero, unidad_negocio_id)")
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(300);
  if (sp.desde) query = query.gte("fecha", sp.desde);
  if (sp.hasta) query = query.lte("fecha", sp.hasta);
  const { data } = await query;
  type Fila = { id: string; cliente_id: string; remito_id: string | null; fecha: string; monto: number; medio: string; referencia: string | null; anulado: boolean; clientes: { nombre: string } | null; remitos: { numero: number; unidad_negocio_id: string | null } | null };
  let pagos = (data ?? []) as unknown as Fila[];
  if (sp.unidad) pagos = pagos.filter((p) => p.remitos?.unidad_negocio_id === sp.unidad);
  const total = pagos.filter((p) => !p.anulado).reduce((a, p) => a + Number(p.monto), 0);

  return (
    <>
      <PageHeader titulo="Pagos" subtitulo={`Total cobrado en este listado: ${formatoMoneda(total)}`}>
        <Link href="/pagos/nuevo" className="btn btn-primary">+ Registrar pago</Link>
      </PageHeader>
      <Mensaje ok={sp.ok} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FiltroUnidad unidades={unidades} actual={sp.unidad} base="/pagos" extra={{ desde: sp.desde, hasta: sp.hasta }} />
        <form className="flex flex-wrap gap-2 no-print">
          {sp.unidad && <input type="hidden" name="unidad" value={sp.unidad} />}
          <input className="input" style={{ width: 160 }} type="date" name="desde" defaultValue={sp.desde ?? ""} />
          <input className="input" style={{ width: 160 }} type="date" name="hasta" defaultValue={sp.hasta ?? ""} />
          <button className="btn btn-secondary">Filtrar</button>
        </form>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Remito</th><th>Unidad</th><th>Medio</th><th>Referencia</th><th className="num">Monto</th><th></th></tr></thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id} style={{ opacity: p.anulado ? 0.5 : 1 }}>
                <td>{formatoFecha(p.fecha)}</td>
                <td><Link className="underline" href={`/clientes/${p.cliente_id}`}>{p.clientes?.nombre}</Link></td>
                <td>{p.remito_id && p.remitos ? <Link className="underline" href={`/remitos/${p.remito_id}`}>{numeroRemito(p.remitos.numero)}</Link> : <span style={{ color: "var(--muted)" }}>a cuenta</span>}</td>
                <td><UnidadBadge unidades={unidades} id={p.remitos?.unidad_negocio_id} /></td>
                <td className="capitalize">{p.medio}</td>
                <td className="text-sm">{p.referencia}</td>
                <td className="num font-semibold">{formatoMoneda(p.monto)}</td>
                <td>{p.anulado && <span className="badge badge-danger">anulado</span>}</td>
              </tr>
            ))}
            {!pagos.length && <tr><td colSpan={8} style={{ color: "var(--muted)" }}>No hay pagos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
