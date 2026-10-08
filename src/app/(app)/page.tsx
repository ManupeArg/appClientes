import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import UnidadBadge from "@/components/UnidadBadge";
import EstadoPagoBadge from "@/components/EstadoPagoBadge";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import { formatoMoneda, formatoNumero, formatoFecha, numeroRemito } from "@/lib/utils";
import type { RemitoSaldo } from "@/lib/types";

export default async function InicioPage() {
  const supabase = await createClient();
  const primerDiaMes = new Date().toISOString().slice(0, 8) + "01";
  const [unidades, saldosUnidad, saldos, stockBajo, ultimosRemitos, ultimosPagos, ventasMes] = await Promise.all([
    getUnidades(supabase),
    supabase.from("saldos_clientes_unidad").select("unidad_negocio_id, saldo"),
    supabase.from("saldos_clientes").select("*").gt("saldo", 0).order("saldo", { ascending: false }).limit(8),
    supabase.from("productos_stock_bajo").select("*").limit(10),
    supabase.from("remitos_saldo").select("id, numero, fecha, total, saldo, estado_pago, unidad_negocio_id, clientes(nombre)").order("creado_en", { ascending: false }).limit(6),
    supabase.from("pagos").select("id, fecha, monto, medio, clientes(nombre)").eq("anulado", false).order("creado_en", { ascending: false }).limit(6),
    supabase.from("remitos").select("total, unidad_negocio_id").eq("estado", "emitido").gte("fecha", primerDiaMes),
  ]);

  const resumen = unidades.map((u) => ({
    u,
    ventas: (ventasMes.data ?? []).filter((r) => r.unidad_negocio_id === u.id).reduce((a, r) => a + Number(r.total), 0),
    cantidad: (ventasMes.data ?? []).filter((r) => r.unidad_negocio_id === u.id).length,
    deuda: (saldosUnidad.data ?? []).filter((s) => s.unidad_negocio_id === u.id).reduce((a, s) => a + Math.max(0, Number(s.saldo)), 0),
  }));
  const totalMes = (ventasMes.data ?? []).reduce((a, r) => a + Number(r.total), 0);
  const totalDeuda = (saldosUnidad.data ?? []).reduce((a, s) => a + Math.max(0, Number(s.saldo)), 0);

  return (
    <>
      <PageHeader titulo="Inicio" subtitulo="Resumen general">
        <Link href="/remitos/nuevo" className="btn btn-primary">+ Nuevo remito</Link>
        <Link href="/pagos/nuevo" className="btn btn-secondary">+ Registrar pago</Link>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {resumen.map(({ u, ventas, cantidad, deuda }) => (
          <div key={u.id} className="card" style={{ borderTop: `3px solid ${u.color}` }}>
            <div className="font-bold mb-2" style={{ color: u.color }}>{u.nombre}</div>
            <div className="label">Ventas del mes</div>
            <div className="text-xl font-bold">{formatoMoneda(ventas)}</div>
            <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>{cantidad} remitos</div>
            <div className="label">A cobrar</div>
            <div className="text-xl font-bold" style={{ color: deuda > 0 ? "var(--warn)" : "var(--ok)" }}>{formatoMoneda(deuda)}</div>
            <Link href={`/remitos?unidad=${u.id}&pendientes=1`} className="text-xs underline" style={{ color: "var(--muted)" }}>ver remitos pendientes</Link>
          </div>
        ))}
        <div className="card" style={{ background: "#141c2e", color: "#fff", borderColor: "#141c2e" }}>
          <div className="font-bold mb-2">Total</div>
          <div className="label" style={{ color: "#8a97b3" }}>Ventas del mes</div>
          <div className="text-xl font-bold">{formatoMoneda(totalMes)}</div>
          <div className="text-xs mb-2" style={{ color: "#8a97b3" }}>{ventasMes.data?.length ?? 0} remitos</div>
          <div className="label" style={{ color: "#8a97b3" }}>A cobrar</div>
          <div className="text-xl font-bold">{formatoMoneda(totalDeuda)}</div>
        </div>
        <div className="card">
          <div className="label">Productos con stock bajo</div>
          <div className="text-3xl font-bold" style={{ color: (stockBajo.data?.length ?? 0) > 0 ? "var(--danger)" : "var(--ok)" }}>{stockBajo.data?.length ?? 0}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>por debajo de su mínimo</div>
          <Link href="/productos?bajo=1" className="text-xs underline" style={{ color: "var(--muted)" }}>ver listado</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-3">Clientes con deuda</h2>
          {saldos.data?.length ? (
            <table className="table">
              <thead><tr><th>Cliente</th><th className="num">Saldo</th></tr></thead>
              <tbody>
                {saldos.data.map((s) => (
                  <tr key={s.cliente_id}>
                    <td><Link className="underline" href={`/clientes/${s.cliente_id}`}>{s.nombre}</Link></td>
                    <td className="num font-semibold">{formatoMoneda(s.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm" style={{ color: "var(--muted)" }}>Nadie debe nada. 🎉</p>}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Stock bajo</h2>
          {stockBajo.data?.length ? (
            <table className="table">
              <thead><tr><th>Producto</th><th>Unidad</th><th className="num">Stock</th><th className="num">Mínimo</th></tr></thead>
              <tbody>
                {stockBajo.data.map((p) => (
                  <tr key={p.id}>
                    <td><Link className="underline" href={`/productos/${p.id}`}>{p.nombre}</Link></td>
                    <td><UnidadBadge unidades={unidades} id={p.unidad_negocio_id} /></td>
                    <td className="num font-semibold" style={{ color: "var(--danger)" }}>{formatoNumero(p.stock)} {p.unidad}</td>
                    <td className="num">{formatoNumero(p.stock_minimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm" style={{ color: "var(--muted)" }}>Todo el stock está por encima del mínimo.</p>}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Últimos remitos</h2>
          <table className="table">
            <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th className="num">Total</th><th></th></tr></thead>
            <tbody>
              {((ultimosRemitos.data ?? []) as unknown as (RemitoSaldo & { clientes: { nombre: string } | null })[]).map((r) => (
                <tr key={r.id}>
                  <td><Link className="underline" href={`/remitos/${r.id}`}>{numeroRemito(r.numero)}</Link></td>
                  <td>{formatoFecha(r.fecha)}</td>
                  <td>{r.clientes?.nombre} <UnidadBadge unidades={unidades} id={r.unidad_negocio_id} /></td>
                  <td className="num">{formatoMoneda(r.total)}</td>
                  <td><EstadoPagoBadge estado={r.estado_pago} /></td>
                </tr>
              ))}
              {!ultimosRemitos.data?.length && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Todavía no hay remitos.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Últimos pagos</h2>
          <table className="table">
            <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {(ultimosPagos.data ?? []).map((p) => {
                const cli = p.clientes as unknown as { nombre: string } | null;
                return (
                  <tr key={p.id}>
                    <td>{formatoFecha(p.fecha)}</td>
                    <td>{cli?.nombre}</td>
                    <td className="capitalize">{p.medio}</td>
                    <td className="num">{formatoMoneda(p.monto)}</td>
                  </tr>
                );
              })}
              {!ultimosPagos.data?.length && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>Todavía no hay pagos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
