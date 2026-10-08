import PageHeader from "@/components/PageHeader";
import RemitoForm from "@/components/RemitoForm";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";

export default async function NuevoRemitoPage({ searchParams }: { searchParams: Promise<{ cliente?: string; unidad?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: clientes }, { data: productos }, unidades] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    getUnidades(supabase),
  ]);
  return (
    <>
      <PageHeader titulo="Nuevo remito" subtitulo="Al emitirlo se descuenta el stock y se carga en la cuenta corriente del cliente" />
      <RemitoForm clientes={clientes ?? []} productos={productos ?? []} unidades={unidades} clienteInicial={sp.cliente} unidadInicial={sp.unidad} />
    </>
  );
}
