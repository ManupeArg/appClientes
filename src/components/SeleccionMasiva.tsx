"use client";

import { useState } from "react";
import { asignarUnidadMasivo } from "@/lib/actions/productos";
import type { Producto, UnidadNegocio } from "@/lib/types";

// Tabla de productos con casillas para asignar la unidad de negocio a varios de una vez
export default function SeleccionMasiva({ productos, unidades, volver, children }: { productos: Producto[]; unidades: UnidadNegocio[]; volver: string; children: (sel: Set<string>, toggle: (id: string) => void) => React.ReactNode }) {
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
      {children(sel, toggle)}
    </form>
  );
}
