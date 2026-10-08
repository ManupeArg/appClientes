import SubmitButton from "@/components/SubmitButton";
import type { Producto, UnidadNegocio } from "@/lib/types";

export default function ProductoForm({ action, producto, unidades }: { action: (fd: FormData) => Promise<void>; producto?: Producto; unidades: UnidadNegocio[] }) {
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Código</label>
          <input className="input" name="codigo" defaultValue={producto?.codigo ?? ""} placeholder="Opcional" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Nombre *</label>
          <input className="input" name="nombre" required defaultValue={producto?.nombre} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Descripción</label>
          <input className="input" name="descripcion" defaultValue={producto?.descripcion ?? ""} />
        </div>
        <div>
          <label className="label">Categoría</label>
          <input className="input" name="categoria" defaultValue={producto?.categoria ?? ""} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Unidad de negocio *</label>
          <select className="select" name="unidad_negocio_id" required defaultValue={producto?.unidad_negocio_id ?? ""}>
            <option value="">— Elegí —</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Precio minorista *</label>
          <input className="input" name="precio_minorista" type="number" step="0.01" min="0" required defaultValue={producto?.precio_minorista ?? ""} />
        </div>
        <div>
          <label className="label">Precio mayorista *</label>
          <input className="input" name="precio_mayorista" type="number" step="0.01" min="0" required defaultValue={producto?.precio_mayorista ?? ""} />
        </div>
        <div>
          <label className="label">Costo (opcional)</label>
          <input className="input" name="costo" type="number" step="0.01" min="0" defaultValue={producto?.costo ?? ""} />
        </div>

        <div>
          <label className="label">Unidad</label>
          <input className="input" name="unidad" defaultValue={producto?.unidad ?? "u"} placeholder="u, kg, m, caja…" />
        </div>
        {!producto && (
          <div>
            <label className="label">Stock inicial</label>
            <input className="input" name="stock" type="number" step="1" min="0" inputMode="numeric" defaultValue="0" />
          </div>
        )}
        <div>
          <label className="label">Stock mínimo (alerta)</label>
          <input className="input" name="stock_minimo" type="number" step="1" min="0" inputMode="numeric" defaultValue={producto?.stock_minimo ?? 0} />
        </div>
        <div className="md:col-span-3 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="alerta_stock" defaultChecked={producto?.alerta_stock ?? true} />
            Avisar por mail cuando el stock esté en el mínimo o por debajo
          </label>
          {producto && (
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="activo" value="off" />
              <input type="checkbox" name="activo" value="on" defaultChecked={producto.activo} />
              Producto activo (se puede vender)
            </label>
          )}
        </div>
      </div>
      <SubmitButton>{producto ? "Guardar cambios" : "Crear producto"}</SubmitButton>
    </form>
  );
}
