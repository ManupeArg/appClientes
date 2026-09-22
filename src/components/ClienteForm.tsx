import SubmitButton from "@/components/SubmitButton";
import type { Cliente } from "@/lib/types";

export default function ClienteForm({ action, cliente }: { action: (fd: FormData) => Promise<void>; cliente?: Cliente }) {
  return (
    <form action={action} className="card space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Nombre / Razón social *</label>
          <input className="input" name="nombre" required defaultValue={cliente?.nombre} />
        </div>
        <div>
          <label className="label">CUIT / DNI</label>
          <input className="input" name="cuit" defaultValue={cliente?.cuit ?? ""} />
        </div>
        <div>
          <label className="label">Lista de precios</label>
          <select className="select" name="tipo_precio" defaultValue={cliente?.tipo_precio ?? "minorista"}>
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
          </select>
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input className="input" name="telefono" defaultValue={cliente?.telefono ?? ""} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" name="email" type="email" defaultValue={cliente?.email ?? ""} />
        </div>
        <div>
          <label className="label">Dirección</label>
          <input className="input" name="direccion" defaultValue={cliente?.direccion ?? ""} />
        </div>
        <div>
          <label className="label">Localidad</label>
          <input className="input" name="localidad" defaultValue={cliente?.localidad ?? ""} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notas</label>
          <textarea className="textarea" name="notas" rows={2} defaultValue={cliente?.notas ?? ""} />
        </div>
        {cliente && (
          <div className="md:col-span-2 flex items-center gap-2">
            <input type="hidden" name="activo" value="off" />
            <input type="checkbox" id="activo" name="activo" value="on" defaultChecked={cliente.activo} />
            <label htmlFor="activo" className="text-sm">Cliente activo</label>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <SubmitButton>{cliente ? "Guardar cambios" : "Crear cliente"}</SubmitButton>
      </div>
    </form>
  );
}
