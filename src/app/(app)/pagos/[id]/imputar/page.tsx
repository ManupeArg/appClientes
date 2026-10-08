import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ImputarForm from "@/components/ImputarForm";
import { createClient } from "@/lib/supabase/server";
import { formatoMoneda, formatoFecha } from "@/lib/utils";
import type { PagoSaldo, RemitoSaldo } from "@/lib/types";

export default async function ImputarPagoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: pagoData } = await supabase.from("pagos_saldo").select("*, clientes(nombre)").eq("id", id).single();
  if (!pagoData) notFound();
  const pago = pagoData as PagoSaldo & { clientes: { nombre: string } };
  const { data: remitos } = await supabase.from("remitos_saldo").select("*").eq("cliente_id", pago.cliente_id).eq("estado", "emitido").gt("saldo", 0).order("numero");

  return (
    <>
      <PageHeader titulo="Imputar pago a remitos" subtitulo={`${pago.clientes.nombre} · pago del ${formatoFecha(pago.fecha)} (${pago.medio}) de ${formatoMoneda(pago.monto)} · a cuenta: ${formatoMoneda(pago.a_cuenta)}`}>
        <Link href={`/clientes/${pago.cliente_id}`} className="btn btn-secondary">← Volver al cliente</Link>
      </PageHeader>
      {Number(pago.a_cuenta) <= 0 ? (
        <div className="alert-ok">Este pago ya está imputado por completo.</div>
      ) : (
        <ImputarForm pagoId={id} clienteId={pago.cliente_id} remitos={(remitos ?? []) as RemitoSaldo[]} disponible={Number(pago.a_cuenta)} />
      )}
    </>
  );
}
