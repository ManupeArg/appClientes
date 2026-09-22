"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearRemito } from "@/lib/actions/remitos";
import { formatoMoneda, formatoNumero, hoyISO } from "@/lib/utils";
import type { Cliente, Producto, TipoPrecio } from "@/lib/types";

interface Linea {
  key: number;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export default function RemitoForm({ clientes, productos, clienteInicial }: { clientes: Cliente[]; productos: Producto[]; clienteInicial?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const clienteSel = clientes.find((c) => c.id === clienteId);
  const [tipoPrecio, setTipoPrecio] = useState<TipoPrecio>(clienteSel?.tipo_precio ?? "minorista");
  const [fecha, setFecha] = useState(hoyISO());
  const [descuento, setDescuento] = useState(0);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ key: 1, producto_id: "", cantidad: 1, precio_unitario: 0 }]);
  const [busqueda, setBusqueda] = useState("");

  const precioDe = (p: Producto, tipo: TipoPrecio) => Number(tipo === "mayorista" ? p.precio_mayorista : p.precio_minorista);

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

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo ?? "").toLowerCase().includes(q));
  }, [busqueda, productos]);

  const sinStock = lineas.some((l) => {
    const p = productos.find((x) => x.id === l.producto_id);
    return p && Number(p.stock) < l.cantidad;
  });

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await crearRemito({
        cliente_id: clienteId,
        fecha,
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

      <div className="card grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="label">Cliente *</label>
          <select className="select" value={clienteId} onChange={(e) => cambiarCliente(e.target.value)}>
            <option value="">— Elegí un cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
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
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="font-semibold">Productos</h2>
          <input className="input max-w-xs" placeholder="Filtrar productos del desplegable…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th style={{ width: "45%" }}>Producto</th><th className="num">Stock</th><th className="num" style={{ width: 110 }}>Cantidad</th><th className="num" style={{ width: 140 }}>Precio unit.</th><th className="num">Subtotal</th><th></th></tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const p = productos.find((x) => x.id === l.producto_id);
                const falta = p && Number(p.stock) < l.cantidad;
                return (
                  <tr key={l.key}>
                    <td>
                      <select className="select" value={l.producto_id} onChange={(e) => elegirProducto(l.key, e.target.value)}>
                        <option value="">— Elegí —</option>
                        {(p && !productosFiltrados.includes(p) ? [p, ...productosFiltrados] : productosFiltrados).map((x) => (
                          <option key={x.id} value={x.id}>{x.codigo ? `[${x.codigo}] ` : ""}{x.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="num text-sm" style={{ color: falta ? "var(--danger)" : "var(--muted)" }}>{p ? `${formatoNumero(p.stock)} ${p.unidad}` : ""}</td>
                    <td><input className="input num" type="number" min="0.01" step="0.01" value={l.cantidad} onChange={(e) => setLinea(l.key, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
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
          <button type="button" className="btn btn-primary w-full justify-center mt-2" disabled={pending || !clienteId} onClick={guardar}>
            {pending ? "Guardando…" : "Emitir remito"}
          </button>
        </div>
      </div>
    </div>
  );
}
