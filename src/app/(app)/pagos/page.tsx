import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import FiltroUnidad from "@/components/FiltroUnidad";
import UnidadesChips from "@/components/UnidadesChips";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda, formatoFecha } from "@/lib/utils";

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ ok?: string; desde?: string; hasta?: string; unidad?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const unidades = await getUnidades(supabase, false);
  let query = supabase
    .from("pagos_saldo")
    .select("*, clientes(nombre)")
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(300);
  if (sp.desde) query = query.gte("fecha", sp.desde);
  if (sp.hasta) query = query.lte("fecha", sp.hasta);
  const { data } = await query;
  type Fila = { id: string; cliente_id: string; fecha: string; monto: number; imputado: number; a_cuenta: number; medio: string; referencia: string | null; anulado: boolean; clientes: { nombre: string } | null };
  let pagos = (data ?? []) as unknown as Fila[];
  const { data: lineas } = await supabase.from("cuenta_corriente").select("pago_id, unidad_negocio_id, remito_id, haber").eq("tipo", "pago").in("pago_id", pagos.map((p) => p.id));
  const partesDe = (pid: string) => (lineas ?? []).filter((l) => l.pago_id === pid && l.remito_id).map((l) => ({ unidad_negocio_id: l.unidad_negocio_id as string | null, importe: Number(l.haber) }));
  if (sp.unidad) pagos = pagos.filter((p) => partesDe(p.id).some((x) => x.unidad_negocio_id === sp.unidad));
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
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Referencia</th><th className="num">Monto</th><th className="num">Imputado</th><th className="num">A cuenta</th><th>Unidades</th><th></th></tr></thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id} style={{ opacity: p.anulado ? 0.5 : 1 }}>
                <td>{formatoFecha(p.fecha)}</td>
                <td><Link className="underline" href={`/clientes/${p.cliente_id}`}>{p.clientes?.nombre}</Link></td>
                <td className="capitalize">{p.medio}</td>
                <td className="text-sm">{p.referencia}</td>
                <td className="num font-semibold">{formatoMoneda(p.monto)}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{Number(p.imputado) ? formatoMoneda(p.imputado) : ""}</td>
                <td className="num" style={{ color: "var(--warn)" }}>{Number(p.a_cuenta) > 0 ? formatoMoneda(p.a_cuenta) : ""}</td>
                <td>{partesDe(p.id).length ? <UnidadesChips unidades={unidades} partes={partesDe(p.id)} /> : <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>}</td>
                <td className="text-right no-print">
                  {p.anulado ? <span className="badge badge-danger">anulado</span> : Number(p.a_cuenta) > 0 ? <Link className="btn btn-secondary btn-sm" href={`/pagos/${p.id}/imputar`}>Imputar</Link> : null}
                </td>
              </tr>
            ))}
            {!pagos.length && <tr><td colSpan={9} style={{ color: "var(--muted)" }}>No hay pagos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
