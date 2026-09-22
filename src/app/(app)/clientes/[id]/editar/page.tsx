import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import ClienteForm from "@/components/ClienteForm";
import { actualizarCliente } from "@/lib/actions/clientes";
import { createClient } from "@/lib/supabase/server";

export default async function EditarClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).single();
  if (!cliente) notFound();
  const action = actualizarCliente.bind(null, id);
  return (
    <>
      <PageHeader titulo={`Editar: ${cliente.nombre}`} />
      <Mensaje error={sp.error} />
      <ClienteForm action={action} cliente={cliente} />
    </>
  );
}
