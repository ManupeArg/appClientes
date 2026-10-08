import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import BusquedaViva from "@/components/BusquedaViva";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda } from "@/lib/utils";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; todos?: string; deuda?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const unidades = await getUnidades(supabase, false);
  let query = supabase.from("saldos_clientes").select("*").order("nombre");
  if (!sp.todos) query = query.eq("activo", true);
  if (sp.q) query = query.ilike("nombre", `%${sp.q}%`);
  if (sp.deuda) query = query.gt("saldo", 0);
  const [{ data: clientes }, { data: porUnidad }] = await Promise.all([query, supabase.from("saldos_clientes_unidad").select("cliente_id, unidad_negocio_id, saldo")]);

  // saldo por cliente y unidad
  const mapa = new Map<string, number>();
  (porUnidad ?? []).forEach((s) => mapa.set(`${s.cliente_id}|${s.unidad_negocio_id ?? ""}`, Number(s.saldo)));
  const totalesUnidad = unidades.map((u) => ({ u, total: (clientes ?? []).reduce((a, c) => a + (mapa.get(`${c.cliente_id}|${u.id}`) ?? 0), 0) }));

  return (
    <>
      <PageHeader titulo="Clientes" subtitulo={`${clientes?.length ?? 0} clientes`}>
        <Link href="/clientes/nuevo" className="btn btn-primary">+ Nuevo cliente</Link>
      </PageHeader>
      <Mensaje ok={sp.ok} />
      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
      <BusquedaViva placeholder="Buscar cliente…" />
      <form className="flex flex-wrap items-center gap-3">
        {sp.q && <input type="hidden" name="q" value={sp.q} />}
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="deuda" value="1" defaultChecked={!!sp.deuda} /> solo con deuda</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="todos" value="1" defaultChecked={!!sp.todos} /> incluir inactivos</label>
        <button className="btn btn-secondary btn-sm">Aplicar</button>
      </form>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th><th>Lista</th>
              {unidades.map((u) => <th key={u.id} className="num" style={{ color: u.color }}>Saldo {u.nombre}</th>)}
              <th className="num">Vencido</th><th className="num">A cuenta</th><th className="num">Saldo total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(clientes ?? []).map((c) => (
              <tr key={c.cliente_id}>
                <td className="font-medium">
                  <Link className="underline" href={`/clientes/${c.cliente_id}`}>{c.nombre}</Link>
                  {!c.activo && <span className="badge badge-muted ml-2">inactivo</span>}
                </td>
                <td><span className={"badge " + (c.tipo_precio === "mayorista" ? "badge-info" : "badge-muted")}>{c.tipo_precio}</span></td>
                {unidades.map((u) => {
                  const s = mapa.get(`${c.cliente_id}|${u.id}`) ?? 0;
                  return <td key={u.id} className="num" style={{ color: s > 0 ? "var(--warn)" : s < 0 ? "var(--ok)" : "var(--muted)" }}>{s ? formatoMoneda(s) : "—"}</td>;
                })}
                <td className="num" style={{ color: "var(--danger)" }}>{Number(c.saldo_vencido) > 0 ? formatoMoneda(c.saldo_vencido) : ""}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{Number(c.a_cuenta) > 0 ? formatoMoneda(c.a_cuenta) : ""}</td>
                <td className="num font-semibold" style={{ color: Number(c.saldo) > 0 ? "var(--warn)" : Number(c.saldo) < 0 ? "var(--ok)" : undefined }}>{formatoMoneda(c.saldo)}</td>
                <td className="text-right"><Link className="btn btn-secondary btn-sm" href={`/remitos/nuevo?cliente=${c.cliente_id}`}>Remito</Link></td>
              </tr>
            ))}
            {!clientes?.length && <tr><td colSpan={6 + unidades.length} style={{ color: "var(--muted)" }}>No hay clientes cargados.</td></tr>}
          </tbody>
          {(clientes?.length ?? 0) > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} className="font-semibold">Total a cobrar</td>
                {totalesUnidad.map(({ u, total }) => <td key={u.id} className="num font-semibold">{formatoMoneda(total)}</td>)}
                <td className="num font-semibold" style={{ color: "var(--danger)" }}>{formatoMoneda((clientes ?? []).reduce((a, c) => a + Number(c.saldo_vencido), 0))}</td>
                <td className="num font-semibold">{formatoMoneda((clientes ?? []).reduce((a, c) => a + Number(c.a_cuenta), 0))}</td>
                <td className="num font-bold">{formatoMoneda((clientes ?? []).reduce((a, c) => a + Number(c.saldo), 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
