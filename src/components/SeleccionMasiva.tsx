"use client";

import { useState } from "react";
import Link from "next/link";
import UnidadBadge from "@/components/UnidadBadge";
import { asignarUnidadMasivo } from "@/lib/actions/productos";
import { formatoMoneda, formatoNumero } from "@/lib/utils";
import type { Producto, UnidadNegocio } from "@/lib/types";

// Tabla de productos con casillas para asignar la unidad de negocio a varios de una vez
export default function SeleccionMasiva({ productos, unidades, volver }: { productos: Producto[]; unidades: UnidadNegocio[]; volver: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todos = () => setSel(sel.size === productos.length ? new Set() : new Set(productos.map((p) => p.id)));

  return (
    <form action={asignarUnidadMasivo}>
      <input type="hidden" name="volver" value={volver} />
      {[...sel].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
      <div className="card mb-3 flex flex-wrap items-center gap-3 no-print" style={{ padding: "0.75rem 1rem" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={todos}>{sel.size === productos.length && productos.length > 0 ? "Deseleccionar todo" : "Seleccionar todo el listado"}</button>
        <span className="text-sm" style={{ color: "var(--muted)" }}>{sel.size} seleccionado/s</span>
        <span className="text-sm">→ asignar a</span>
        <select className="select" style={{ width: 180 }} name="unidad_negocio_id" defaultValue="">
          <option value="">— unidad —</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" type="submit" disabled={sel.size === 0}>Asignar unidad</button>
        <span className="text-xs" style={{ color: "var(--muted)" }}>Tip: filtrá por categoría o nombre, "seleccionar todo" y asignás de un saque.</span>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th></th><th>Código</th><th>Producto</th><th>Unidad</th><th>Categoría</th><th className="num">Minorista</th><th className="num">Mayorista</th><th className="num">Stock</th><th className="num">Mínimo</th></tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const bajo = p.alerta_stock && Number(p.stock) <= Number(p.stock_minimo);
              return (
                <tr key={p.id}>
                  <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                  <td className="text-xs" style={{ color: "var(--muted)" }}>{p.codigo}</td>
                  <td className="font-medium">
                    <Link className="underline" href={`/productos/${p.id}`}>{p.nombre}</Link>
                    {!p.activo && <span className="badge badge-muted ml-2">inactivo</span>}
                  </td>
                  <td><UnidadBadge unidades={unidades} id={p.unidad_negocio_id} /></td>
                  <td>{p.categoria}</td>
                  <td className="num">{formatoMoneda(p.precio_minorista)}</td>
                  <td className="num">{formatoMoneda(p.precio_mayorista)}</td>
                  <td className="num font-semibold" style={{ color: bajo ? "var(--danger)" : undefined }}>
                    {formatoNumero(p.stock)} {p.unidad}
                    {bajo && <span className="badge badge-danger ml-2">bajo</span>}
                  </td>
                  <td className="num">{p.alerta_stock ? formatoNumero(p.stock_minimo) : <span style={{ color: "var(--muted)" }}>sin alerta</span>}</td>
                </tr>
              );
            })}
            {!productos.length && <tr><td colSpan={9} style={{ color: "var(--muted)" }}>No hay productos.</td></tr>}
          </tbody>
        </table>
      </div>
    </form>
  );
}
