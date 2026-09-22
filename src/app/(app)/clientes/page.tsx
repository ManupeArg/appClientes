import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import { createClient } from "@/lib/supabase/server";
import { formatoMoneda } from "@/lib/utils";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; todos?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("saldos_clientes").select("*").order("nombre");
  if (!sp.todos) query = query.eq("activo", true);
  if (sp.q) query = query.ilike("nombre", `%${sp.q}%`);
  const { data: clientes } = await query;

  return (
    <>
      <PageHeader titulo="Clientes" subtitulo={`${clientes?.length ?? 0} clientes`}>
        <Link href="/clientes/nuevo" className="btn btn-primary">+ Nuevo cliente</Link>
      </PageHeader>
      <Mensaje ok={sp.ok} />
      <form className="flex gap-2 mb-4 no-print">
        <input className="input max-w-sm" name="q" placeholder="Buscar por nombre…" defaultValue={sp.q ?? ""} />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="todos" value="1" defaultChecked={!!sp.todos} /> incluir inactivos</label>
        <button className="btn btn-secondary">Buscar</button>
      </form>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Nombre</th><th>Lista</th><th className="num">Total comprado</th><th className="num">Total pagado</th><th className="num">Saldo</th><th></th></tr>
          </thead>
          <tbody>
            {(clientes ?? []).map((c) => (
              <tr key={c.cliente_id}>
                <td className="font-medium">
                  <Link className="underline" href={`/clientes/${c.cliente_id}`}>{c.nombre}</Link>
                  {!c.activo && <span className="badge badge-muted ml-2">inactivo</span>}
                </td>
                <td><span className={"badge " + (c.tipo_precio === "mayorista" ? "badge-info" : "badge-muted")}>{c.tipo_precio}</span></td>
                <td className="num">{formatoMoneda(c.total_debe)}</td>
                <td className="num">{formatoMoneda(c.total_haber)}</td>
                <td className="num font-semibold" style={{ color: Number(c.saldo) > 0 ? "var(--warn)" : Number(c.saldo) < 0 ? "var(--ok)" : undefined }}>{formatoMoneda(c.saldo)}</td>
                <td className="text-right"><Link className="btn btn-secondary btn-sm" href={`/remitos/nuevo?cliente=${c.cliente_id}`}>Remito</Link></td>
              </tr>
            ))}
            {!clientes?.length && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No hay clientes cargados.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
