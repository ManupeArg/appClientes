"use client";

import { useMemo, useState } from "react";
import Combobox from "@/components/Combobox";
import SubmitButton from "@/components/SubmitButton";
import { crearPago } from "@/lib/actions/pagos";
import { formatoMoneda, formatoFecha, numeroRemito, hoyISO } from "@/lib/utils";
import type { Cliente, RemitoSaldo, UnidadNegocio } from "@/lib/types";
import { nombreUnidad } from "@/lib/unidades";

export default function PagoForm({
  clientes,
  remitos,
  unidades,
  clienteInicial,
  remitoInicial,
}: {
  clientes: Cliente[];
  remitos: RemitoSaldo[]; // remitos con saldo pendiente
  unidades: UnidadNegocio[];
  clienteInicial?: string;
  remitoInicial?: string;
}) {
  const [clienteId, setClienteId] = useState(clienteInicial ?? remitos.find((r) => r.id === remitoInicial)?.cliente_id ?? "");
  const [remitoId, setRemitoId] = useState(remitoInicial ?? "");
  const remitoSel = remitos.find((r) => r.id === remitoId);
  const [monto, setMonto] = useState<string>(remitoSel ? String(remitoSel.saldo) : "");

  const opcionesClientes = useMemo(
    () => clientes.map((c) => ({ value: c.id, label: c.nombre, sub: c.localidad ?? undefined, keywords: [c.cuit, c.telefono].filter(Boolean).join(" ") })),
    [clientes]
  );

  const remitosCliente = useMemo(() => remitos.filter((r) => r.cliente_id === clienteId), [remitos, clienteId]);
  const opcionesRemitos = useMemo(
    () =>
      remitosCliente.map((r) => ({
        value: r.id,
        label: `${numeroRemito(r.numero)} · ${formatoFecha(r.fecha)} · ${nombreUnidad(unidades, r.unidad_negocio_id)}`,
        sub: `debe ${formatoMoneda(r.saldo)} de ${formatoMoneda(r.total)}`,
        keywords: String(r.numero),
      })),
    [remitosCliente, unidades]
  );

  function elegirRemito(id: string) {
    setRemitoId(id);
    const r = remitos.find((x) => x.id === id);
    setMonto(r ? String(r.saldo) : "");
  }

  function elegirCliente(id: string) {
    setClienteId(id);
    setRemitoId("");
    setMonto("");
  }

  const montoNum = parseFloat(monto.replace(",", ".")) || 0;
  const excede = remitoSel ? montoNum > Number(remitoSel.saldo) + 0.009 : false;

  return (
    <form action={crearPago} className="card max-w-xl space-y-4">
      <input type="hidden" name="volver_error" value="/pagos/nuevo" />
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="remito_id" value={remitoId} />

      <div>
        <label className="label">Cliente *</label>
        <Combobox opciones={opcionesClientes} value={clienteId} onChange={elegirCliente} placeholder="Nombre, CUIT o teléfono…" autoFocus={!clienteInicial && !remitoInicial} />
      </div>

      <div>
        <label className="label">Remito que se paga *</label>
        {clienteId && remitosCliente.length === 0 ? (
          <div className="alert-ok">Este cliente no tiene remitos pendientes de pago.</div>
        ) : (
          <Combobox opciones={opcionesRemitos} value={remitoId} onChange={elegirRemito} placeholder={clienteId ? "Elegí el remito…" : "Primero elegí el cliente"} disabled={!clienteId} />
        )}
        {remitoSel && (
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Total {formatoMoneda(remitoSel.total)} · ya pagado {formatoMoneda(remitoSel.pagado)} · <strong>pendiente {formatoMoneda(remitoSel.saldo)}</strong>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha</label>
          <div className="input" style={{ background: "#f3f4f6" }}>{formatoFecha(hoyISO())}</div>
        </div>
        <div>
          <label className="label">Monto *</label>
          <input className="input" type="number" step="0.01" min="0.01" name="monto" required value={monto} onChange={(e) => setMonto(e.target.value)} />
          {excede && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>Supera lo pendiente del remito.</p>}
        </div>
        <div>
          <label className="label">Medio de pago</label>
          <select className="select" name="medio" defaultValue="efectivo">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cheque">Cheque</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="label">Referencia</label>
          <input className="input" name="referencia" placeholder="N° operación, cheque…" />
        </div>
      </div>
      <div>
        <label className="label">Observaciones</label>
        <textarea className="textarea" name="observaciones" rows={2} />
      </div>
      <SubmitButton>Registrar pago</SubmitButton>
      {(!remitoId || excede) && <p className="text-xs" style={{ color: "var(--muted)" }}>Elegí un remito y un monto que no supere lo pendiente.</p>}
    </form>
  );
}
