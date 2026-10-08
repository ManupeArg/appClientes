"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Combobox from "@/components/Combobox";
import { crearRemito } from "@/lib/actions/remitos";
import { formatoMoneda, formatoNumero, formatoFecha, hoyISO } from "@/lib/utils";
import type { Cliente, Producto, TipoPrecio, UnidadNegocio } from "@/lib/types";

interface Linea {
  key: number;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export default function RemitoForm({
  clientes,
  productos,
  unidades,
  clienteInicial,
}: {
  clientes: Cliente[];
  productos: Producto[];
  unidades: UnidadNegocio[];
  clienteInicial?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const clienteSel = clientes.find((c) => c.id === clienteId);
  const [tipoPrecio, setTipoPrecio] = useState<TipoPrecio>(clienteSel?.tipo_precio ?? "minorista");
  const [descuento, setDescuento] = useState(0);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ key: 1, producto_id: "", cantidad: 1, precio_unitario: 0 }]);

  const precioDe = (p: Producto, tipo: TipoPrecio) => Number(tipo === "mayorista" ? p.precio_mayorista : p.precio_minorista);

  const nombreUnidad = (id: string | null) => unidades.find((u) => u.id === id)?.nombre ?? "sin unidad";

  const opcionesClientes = useMemo(
    () => clientes.map((c) => ({ value: c.id, label: c.nombre, sub: c.localidad ?? undefined, keywords: [c.cuit, c.telefono].filter(Boolean).join(" ") })),
    [clientes]
  );
  const opcionesProductos = useMemo(
    () =>
      productos.map((p) => ({
        value: p.id,
        label: p.nombre,
        sub: `${p.codigo ? p.codigo + " · " : ""}${nombreUnidad(p.unidad_negocio_id)} · stock ${formatoNumero(p.stock)} · ${formatoMoneda(precioDe(p, tipoPrecio))}`,
        keywords: [p.codigo, p.categoria, nombreUnidad(p.unidad_negocio_id)].filter(Boolean).join(" "),
      })),
    [productos, tipoPrecio, unidades]
  );

  function cambiarCliente(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c) cambiarTipoPrecio(c.tipo_precio);
  }

  function cambiarTipoPrecio(tipo: TipoPrecio) {
    setTipoPrecio(tipo);
    setLineas((ls) =>
      ls.map((l) => {
        const p = productos.find((x) => x.id === l.producto_id);
        return p ? { ...l, precio_unitario: precioDe(p, tipo) } : l;
      })
    );
  }

  function setLinea(key: number, cambios: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
  }

  function elegirProducto(key: number, producto_id: string) {
    const p = productos.find((x) => x.id === producto_id);
    setLinea(key, { producto_id, precio_unitario: p ? precioDe(p, tipoPrecio) : 0 });
  }

  function agregarLinea() {
    setLineas((ls) => [...ls, { key: Date.now(), producto_id: "", cantidad: 1, precio_unitario: 0 }]);
  }

  function quitarLinea(key: number) {
    setLineas((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  const subtotal = useMemo(() => lineas.reduce((a, l) => a + l.cantidad * l.precio_unitario, 0), [lineas]);
  const total = Math.max(0, subtotal - (descuento || 0));

  const sinStock = lineas.some((l) => {
    const p = productos.find((x) => x.id === l.producto_id);
    return p && Number(p.stock) < l.cantidad;
  });

  const puedeGuardar = !!clienteId && lineas.some((l) => l.producto_id && l.cantidad > 0);

  // Resumen por unidad de negocio (lo que va a ir a cada cuenta)
  const porUnidad = useMemo(() => {
    const m = new Map<string | null, number>();
    lineas.forEach((l) => {
      const p = productos.find((x) => x.id === l.producto_id);
      if (!p) return;
      m.set(p.unidad_negocio_id, (m.get(p.unidad_negocio_id) ?? 0) + l.cantidad * l.precio_unitario);
    });
    return [...m.entries()];
  }, [lineas, productos]);

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await crearRemito({
        cliente_id: clienteId,
        tipo_precio: tipoPrecio,
        descuento: descuento || 0,
        observaciones,
        items: lineas.map(({ producto_id, cantidad, precio_unitario }) => ({ producto_id, cantidad, precio_unitario })),
      });
      if (res.ok) router.push(`/remitos/${res.id}?ok=` + encodeURIComponent("Remito creado. El stock ya se descontó y quedó en la cuenta corriente del cliente."));
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="alert-error">{error}</div>}

      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="label">Cliente *</label>
            <Combobox opciones={opcionesClientes} value={clienteId} onChange={cambiarCliente} placeholder="Nombre, CUIT o teléfono…" autoFocus={!clienteInicial} />
          </div>
          <div>
            <label className="label">Lista de precios</label>
            <select className="select" value={tipoPrecio} onChange={(e) => cambiarTipoPrecio(e.target.value as TipoPrecio)}>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </div>
          <div>
            <label className="label">Fecha</label>
            <div className="input" style={{ background: "#f3f4f6" }}>{formatoFecha(hoyISO())}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Productos</h2>
        <div>
          <table className="table">
            <thead>
              <tr><th style={{ width: "48%" }}>Producto</th><th className="num">Stock</th><th className="num" style={{ width: 100 }}>Cantidad</th><th className="num" style={{ width: 140 }}>Precio unit.</th><th className="num">Subtotal</th><th></th></tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const p = productos.find((x) => x.id === l.producto_id);
                const falta = p && Number(p.stock) < l.cantidad;
                return (
                  <tr key={l.key}>
                    <td style={{ overflow: "visible" }}>
                      <Combobox opciones={opcionesProductos} value={l.producto_id} onChange={(v) => elegirProducto(l.key, v)} placeholder="Nombre o código…" />
                    </td>
                    <td className="num text-sm" style={{ color: falta ? "var(--danger)" : "var(--muted)" }}>{p ? `${formatoNumero(p.stock)} ${p.unidad}` : ""}</td>
                    <td>
                      <input
                        className="input num"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={l.cantidad}
                        onChange={(e) => setLinea(l.key, { cantidad: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      />
                    </td>
                    <td><input className="input num" type="number" min="0" step="0.01" value={l.precio_unitario} onChange={(e) => setLinea(l.key, { precio_unitario: parseFloat(e.target.value) || 0 })} /></td>
                    <td className="num font-semibold">{formatoMoneda(l.cantidad * l.precio_unitario)}</td>
                    <td><button type="button" className="btn btn-danger btn-sm" onClick={() => quitarLinea(l.key)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-secondary mt-3" onClick={agregarLinea}>+ Agregar línea</button>
        {porUnidad.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            {porUnidad.map(([uid, imp]) => {
              const u = unidades.find((x) => x.id === uid);
              return (
                <span key={uid ?? "null"} className="badge" style={{ background: (u?.color ?? "#6b7280") + "22", color: u?.color ?? "#6b7280", fontSize: "0.8rem", textTransform: "none" }}>
                  {u?.nombre ?? "Sin unidad"}: {formatoMoneda(imp)}
                </span>
              );
            })}
            {porUnidad.length > 1 && <span style={{ color: "var(--muted)" }}>Este remito va a las dos cuentas: cada unidad recibe su parte (y el descuento se reparte proporcional).</span>}
          </div>
        )}
        {sinStock && <div className="alert-error mt-3">Ojo: alguna línea supera el stock disponible. Se puede guardar igual y el stock quedará en negativo.</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card md:col-span-2">
          <label className="label">Observaciones</label>
          <textarea className="textarea" rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Se imprimen en el remito" />
        </div>
        <div className="card space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatoMoneda(subtotal)}</span></div>
          <div className="flex justify-between items-center text-sm gap-2">
            <span>Descuento</span>
            <input className="input num" style={{ width: 120 }} type="number" min="0" step="0.01" value={descuento} onChange={(e) => setDescuento(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2" style={{ borderColor: "var(--border)" }}><span>Total</span><span>{formatoMoneda(total)}</span></div>
          <button type="button" className="btn btn-primary w-full justify-center mt-2" disabled={pending || !puedeGuardar} onClick={guardar}>
            {pending ? "Guardando…" : "Emitir remito"}
          </button>
        </div>
      </div>
    </div>
  );
}
