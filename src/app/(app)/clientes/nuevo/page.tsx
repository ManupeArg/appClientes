import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import ClienteForm from "@/components/ClienteForm";
import { crearCliente } from "@/lib/actions/clientes";

export default async function NuevoClientePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader titulo="Nuevo cliente" />
      <Mensaje error={sp.error} />
      <ClienteForm action={crearCliente} />
    </>
  );
}
