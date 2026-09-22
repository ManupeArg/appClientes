import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import { createClient } from "@/lib/supabase/server";
import { formatoMoneda, formatoFecha } from "@/lib/utils";

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ ok?: string; desde?: string; hasta?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("pagos").select("*, clientes(nombre)").order("fecha", { ascending: false }).order("creado_en", { ascending: false }).limit(200);
  if (sp.desde) query = query.gte("fecha", sp.desde);
  if (sp.hasta) query = query.lte("fecha", sp.hasta);
  const { data: pagos } = await query;
  const total = (pagos ?? []).filter((p) => !p.anulado).reduce((a, p) => a + Number(p.monto), 0);

  return (
    <>
      <PageHeader titulo="Pagos" subtitulo={`Total del listado: ${formatoMoneda(total)}`}>
        <Link href="/pagos/nuevo" className="btn btn-primary">+ Registrar pago</Link>
      </PageHeader>
      <Mensaje ok={sp.ok} />
      <form className="flex flex-wrap gap-2 mb-4 no-print">
        <input className="input" style={{ width: 160 }} type="date" name="desde" defaultValue={sp.desde ?? ""} />
        <input className="input" style={{ width: 160 }} type="date" name="hasta" defaultValue={sp.hasta ?? ""} />
        <button className="btn btn-secondary">Filtrar</button>
      </form>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Referencia</th><th className="num">Monto</th><th></th></tr></thead>
          <tbody>
            {(pagos ?? []).map((p) => {
              const cli = p.clientes as unknown as { nombre: string };
              return (
                <tr key={p.id} style={{ opacity: p.anulado ? 0.5 : 1 }}>
                  <td>{formatoFecha(p.fecha)}</td>
                  <td><Link className="underline" href={`/clientes/${p.cliente_id}`}>{cli.nombre}</Link></td>
                  <td className="capitalize">{p.medio}</td>
                  <td className="text-sm">{p.referencia}</td>
                  <td className="num font-semibold">{formatoMoneda(p.monto)}</td>
                  <td>{p.anulado && <span className="badge badge-danger">anulado</span>}</td>
                </tr>
              );
            })}
            {!pagos?.length && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No hay pagos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
