import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import SubmitButton from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { guardarNegocio, guardarAlertas, actualizarUsuario, enviarAlertaAhora, guardarUnidad, completarUnidadRemitos } from "@/lib/actions/configuracion";
import { getUnidades } from "@/lib/unidades";
import { formatoFecha } from "@/lib/utils";
import type { Perfil } from "@/lib/types";

export default async function ConfiguracionPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: config }, { data: perfiles }, { data: alertas }, { data: yo }, unidades, { count: remitosSinUnidad }] = await Promise.all([
    supabase.from("configuracion").select("*"),
    supabase.from("perfiles").select("*").order("creado_en"),
    supabase.from("alertas_enviadas").select("*").order("enviado_en", { ascending: false }).limit(10),
    supabase.from("perfiles").select("rol").eq("id", user!.id).single(),
    getUnidades(supabase, false),
    supabase.from("remitos").select("id", { count: "exact", head: true }).is("unidad_negocio_id", null),
  ]);
  const esAdmin = yo?.rol === "admin";
  const negocio = (config?.find((c) => c.clave === "negocio")?.valor ?? {}) as Record<string, string>;
  const alertasCfg = (config?.find((c) => c.clave === "alertas_stock")?.valor ?? {}) as { emails?: string[]; activo?: boolean };

  return (
    <>
      <PageHeader titulo="Configuración" subtitulo={esAdmin ? "Solo los administradores pueden modificar esta sección" : "Solo lectura: no sos administrador"} />
      <Mensaje error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold">Unidades de negocio</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Cada producto y cada remito pertenecen a una unidad. Las ventas y la deuda se ven separadas por unidad.</p>
          </div>
          <table className="table">
            <thead><tr><th>Nombre</th><th>Color</th><th>Orden</th><th>Activa</th><th></th></tr></thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id}>
                  {esAdmin ? (
                    <td colSpan={5}>
                      <form action={guardarUnidad} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <input className="input" style={{ width: 160 }} name="nombre" defaultValue={u.nombre} required />
                        <input type="color" name="color" defaultValue={u.color} style={{ width: 40, height: 34, border: "none", background: "none" }} />
                        <input className="input" style={{ width: 70 }} type="number" name="orden" defaultValue={u.orden} />
                        <label className="text-sm flex items-center gap-1"><input type="checkbox" name="activo" defaultChecked={u.activo} /> activa</label>
                        <button className="btn btn-secondary btn-sm" type="submit">Guardar</button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ color: u.color }} className="font-semibold">{u.nombre}</td>
                      <td><span className="badge" style={{ background: u.color, color: "#fff" }}>{u.color}</span></td>
                      <td>{u.orden}</td>
                      <td>{u.activo ? "Sí" : "No"}</td>
                      <td></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {esAdmin && (
            <form action={guardarUnidad} className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <input className="input" style={{ width: 160 }} name="nombre" placeholder="Nueva unidad…" required />
              <input type="color" name="color" defaultValue="#178a4c" style={{ width: 40, height: 34, border: "none", background: "none" }} />
              <input className="input" style={{ width: 70 }} type="number" name="orden" defaultValue={unidades.length + 1} />
              <input type="hidden" name="activo" value="on" />
              <button className="btn btn-primary btn-sm" type="submit">Agregar</button>
            </form>
          )}
          {(remitosSinUnidad ?? 0) > 0 && (
            <div className="alert-error flex flex-wrap items-center justify-between gap-2">
              <span>Hay {remitosSinUnidad} remitos viejos sin unidad de negocio.</span>
              {esAdmin && (
                <form action={completarUnidadRemitos}>
                  <SubmitButton className="btn btn-secondary btn-sm">Completar según sus productos</SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>

        <form action={guardarAlertas} className="card space-y-4">
          <div>
            <h2 className="font-semibold">Alertas de stock bajo por mail</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Todos los días a las 8:00 se envía un resumen con los productos que están en su mínimo o por debajo. El mínimo se define en cada producto.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activo" defaultChecked={alertasCfg.activo ?? true} disabled={!esAdmin} /> Alertas activas
          </label>
          <div>
            <label className="label">Destinatarios (uno por línea o separados por coma)</label>
            <textarea className="textarea" name="emails" rows={4} defaultValue={(alertasCfg.emails ?? []).join("\n")} disabled={!esAdmin} placeholder="vos@tuempresa.com&#10;deposito@tuempresa.com" />
          </div>
          {esAdmin && <SubmitButton>Guardar destinatarios</SubmitButton>}
        </form>

        <div className="space-y-6">
          <div className="card space-y-3">
            <h2 className="font-semibold">Probar el envío</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Manda ahora mismo la alerta con los productos que estén bajos (si no hay ninguno, no envía nada).</p>
            {esAdmin && (
              <form action={enviarAlertaAhora}>
                <SubmitButton className="btn btn-secondary">Enviar alerta ahora</SubmitButton>
              </form>
            )}
          </div>
          <div className="card">
            <h2 className="font-semibold mb-2">Últimos envíos</h2>
            <table className="table">
              <tbody>
                {(alertas ?? []).map((a) => (
                  <tr key={a.id}>
                    <td className="text-xs" style={{ color: "var(--muted)" }}>{formatoFecha(a.enviado_en)}</td>
                    <td className="text-sm">{(a.destinatarios as string[]).join(", ")}</td>
                    <td className="text-sm num">{(a.productos as unknown[]).length} prod.</td>
                    <td>{a.ok ? <span className="badge badge-ok">ok</span> : <span className="badge badge-danger" title={a.error ?? ""}>error</span>}</td>
                  </tr>
                ))}
                {!alertas?.length && <tr><td style={{ color: "var(--muted)" }}>Todavía no se envió ninguna alerta.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <form action={guardarNegocio} className="card space-y-4">
          <div>
            <h2 className="font-semibold">Datos del negocio</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Aparecen en el encabezado de los remitos.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nombre</label><input className="input" name="nombre" defaultValue={negocio.nombre ?? "MSP"} disabled={!esAdmin} /></div>
            <div><label className="label">CUIT</label><input className="input" name="cuit" defaultValue={negocio.cuit ?? ""} disabled={!esAdmin} /></div>
            <div><label className="label">Teléfono</label><input className="input" name="telefono" defaultValue={negocio.telefono ?? ""} disabled={!esAdmin} /></div>
            <div className="col-span-2"><label className="label">Dirección</label><input className="input" name="direccion" defaultValue={negocio.direccion ?? ""} disabled={!esAdmin} /></div>
            <div className="col-span-2"><label className="label">Email</label><input className="input" name="email" defaultValue={negocio.email ?? ""} disabled={!esAdmin} /></div>
          </div>
          {esAdmin && <SubmitButton>Guardar datos</SubmitButton>}
        </form>

        <div className="card">
          <h2 className="font-semibold mb-1">Usuarios</h2>
          <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>Cada persona se registra desde la pantalla de registro; acá le asignás el rol o la desactivás.</p>
          <table className="table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th></th></tr></thead>
            <tbody>
              {((perfiles ?? []) as Perfil[]).map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.nombre}</td>
                  <td className="text-sm">{p.email}</td>
                  {esAdmin && p.id !== user!.id ? (
                    <td colSpan={3}>
                      <form action={actualizarUsuario.bind(null, p.id)} className="flex items-center gap-2">
                        <select className="select" style={{ width: 130 }} name="rol" defaultValue={p.rol}>
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <label className="text-sm flex items-center gap-1"><input type="checkbox" name="activo" defaultChecked={p.activo} /> activo</label>
                        <button className="btn btn-secondary btn-sm" type="submit">Guardar</button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="capitalize">{p.rol}</td>
                      <td>{p.activo ? "Sí" : "No"}</td>
                      <td className="text-xs" style={{ color: "var(--muted)" }}>{p.id === user!.id ? "(vos)" : ""}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
