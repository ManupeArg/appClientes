import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import ProductoForm from "@/components/ProductoForm";
import { crearProducto } from "@/lib/actions/productos";
import { createClient } from "@/lib/supabase/server";
import { getUnidades } from "@/lib/unidades";

export default async function NuevoProductoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const unidades = await getUnidades(await createClient());
  return (
    <>
      <PageHeader titulo="Nuevo producto" />
      <Mensaje error={sp.error} />
      <ProductoForm action={crearProducto} unidades={unidades} />
    </>
  );
}
