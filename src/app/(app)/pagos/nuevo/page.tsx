import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import SubmitButton from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { crearPago } from "@/lib/actions/pagos";
import { formatoMoneda, hoyISO } from "@/lib/utils";

export default async function NuevoPagoPage({ searchParams }: { searchParams: Promise<{ cliente?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: clientes } = await supabase.from("saldos_clientes").select("*").eq("activo", true).order("nombre");

  return (
    <>
      <PageHeader titulo="Registrar pago" subtitulo="Se acredita en la cuenta corriente del cliente" />
      <Mensaje error={sp.error} />
      <form action={crearPago} className="card max-w-xl space-y-4">
        <input type="hidden" name="volver_error" value={`/pagos/nuevo${sp.cliente ? `?cliente=${sp.cliente}` : ""}`} />
        <div>
          <label className="label">Cliente *</label>
          <select className="select" name="cliente_id" required defaultValue={sp.cliente ?? ""}>
            <option value="">— Elegí un cliente —</option>
            {(clientes ?? []).map((c) => (
              <option key={c.cliente_id} value={c.cliente_id}>
                {c.nombre} {Number(c.saldo) !== 0 ? `(saldo ${formatoMoneda(c.saldo)})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha</label>
            <input className="input" type="date" name="fecha" defaultValue={hoyISO()} required />
          </div>
          <div>
            <label className="label">Monto *</label>
            <input className="input" type="number" step="0.01" min="0.01" name="monto" required />
          </div>
          <div>
            <label className="label">Medio de pago</label>
            <select className="select" name="medio" defaultValue="efectivo">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="cheque">Cheque</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="label">Referencia</label>
            <input className="input" name="referencia" placeholder="N° operación, cheque…" />
          </div>
        </div>
        <div>
          <label className="label">Observaciones</label>
          <textarea className="textarea" name="observaciones" rows={2} />
        </div>
        <SubmitButton>Registrar pago</SubmitButton>
      </form>
    </>
  );
}
