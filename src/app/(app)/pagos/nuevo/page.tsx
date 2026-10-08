import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import PagoForm from "@/components/PagoForm";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";
import type { Cliente, RemitoSaldo } from "@/lib/types";

export default async function NuevoPagoPage({ searchParams }: { searchParams: Promise<{ cliente?: string; remito?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: clientes }, { data: remitos }, unidades] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("remitos_saldo").select("*").eq("estado", "emitido").gt("saldo", 0).order("numero", { ascending: false }),
    getUnidades(supabase, false),
  ]);

  return (
    <>
      <PageHeader titulo="Registrar pago" subtitulo="El pago se aplica a un remito puntual y se acredita en la cuenta corriente del cliente" />
      <Mensaje error={sp.error} />
      <PagoForm
        clientes={(clientes ?? []) as Cliente[]}
        remitos={(remitos ?? []) as RemitoSaldo[]}
        unidades={unidades}
        clienteInicial={sp.cliente}
        remitoInicial={sp.remito}
      />
    </>
  );
}
