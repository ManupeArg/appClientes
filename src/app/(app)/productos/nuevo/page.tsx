import PageHeader from "@/components/PageHeader";
import Mensaje from "@/components/Mensaje";
import ProductoForm from "@/components/ProductoForm";
import { crearProducto } from "@/lib/actions/productos";

export default async function NuevoProductoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader titulo="Nuevo producto" />
      <Mensaje error={sp.error} />
      <ProductoForm action={crearProducto} />
    </>
  );
}
