import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { formatoMoneda, formatoFecha, numeroRemito } from "@/lib/utils";

export default async function RemitosPage({ searchParams }: { searchParams: Promise<{ q?: string; desde?: string; hasta?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("remitos").select("*, clientes!inner(nombre)").order("numero", { ascending: false }).limit(200);
  if (sp.q) query = query.ilike("clientes.nombre", `%${sp.q}%`);
  if (sp.desde) query = query.gte("fecha", sp.desde);
  if (sp.hasta) query = query.lte("fecha", sp.hasta);
  const { data: remitos } = await query;

  return (
    <>
      <PageHeader titulo="Remitos" subtitulo="Ventas / entregas">
        <Link href="/remitos/nuevo" className="btn btn-primary">+ Nuevo remito</Link>
      </PageHeader>
      <form className="flex flex-wrap gap-2 mb-4 no-print">
        <input className="input max-w-xs" name="q" placeholder="Cliente…" defaultValue={sp.q ?? ""} />
        <input className="input" style={{ width: 160 }} type="date" name="desde" defaultValue={sp.desde ?? ""} />
        <input className="input" style={{ width: 160 }} type="date" name="hasta" defaultValue={sp.hasta ?? ""} />
        <button className="btn btn-secondary">Filtrar</button>
      </form>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Lista</th><th className="num">Total</th><th>Estado</th></tr></thead>
          <tbody>
            {(remitos ?? []).map((r) => {
              const cli = r.clientes as unknown as { nombre: string };
              return (
                <tr key={r.id}>
                  <td><Link className="underline font-medium" href={`/remitos/${r.id}`}>{numeroRemito(r.numero)}</Link></td>
                  <td>{formatoFecha(r.fecha)}</td>
                  <td><Link className="underline" href={`/clientes/${r.cliente_id}`}>{cli.nombre}</Link></td>
                  <td className="capitalize">{r.tipo_precio}</td>
                  <td className="num font-semibold">{formatoMoneda(r.total)}</td>
                  <td>{r.estado === "anulado" ? <span className="badge badge-danger">anulado</span> : <span className="badge badge-ok">emitido</span>}</td>
                </tr>
              );
            })}
            {!remitos?.length && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No hay remitos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
