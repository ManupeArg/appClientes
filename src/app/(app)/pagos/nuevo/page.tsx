import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import PagoForm from "@/components/PagoForm";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, RemitoSaldo } from "@/lib/types";

export default async function NuevoPagoPage({ searchParams }: { searchParams: Promise<{ cliente?: string; remito?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: clientes }, { data: remitos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("remitos_saldo").select("*").eq("estado", "emitido").gt("saldo", 0).order("numero"),
  ]);
  return (
    <>
      <PageHeader titulo="Registrar pago" subtitulo="Se registra al cliente y se imputa a los remitos que paga; lo que sobra queda a cuenta" />
      <Mensaje error={sp.error} />
      <PagoForm clientes={(clientes ?? []) as Cliente[]} remitos={(remitos ?? []) as RemitoSaldo[]} clienteInicial={sp.cliente} remitoInicial={sp.remito} />
    </>
  );
}
