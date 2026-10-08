"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Combobox from "@/components/Combobox";
import ImputacionTabla, { type Asignacion } from "@/components/ImputacionTabla";
import { crearPago } from "@/lib/actions/pagos";
import { formatoMoneda, formatoFecha, hoyISO } from "@/lib/utils";
import type { Cliente, RemitoSaldo } from "@/lib/types";

export default function PagoForm({
  clientes,
  remitos,
  clienteInicial,
  remitoInicial,
}: {
  clientes: Cliente[];
  remitos: RemitoSaldo[]; // remitos con saldo pendiente (de todos los clientes)
  clienteInicial?: string;
  remitoInicial?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const remitoIni = remitos.find((r) => r.id === remitoInicial);

  const [clienteId, setClienteId] = useState(clienteInicial ?? remitoIni?.cliente_id ?? "");
  const [monto, setMonto] = useState<string>(remitoIni ? String(remitoIni.saldo) : "");
  const [medio, setMedio] = useState("efectivo");
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>(remitoIni ? [{ remito_id: remitoIni.id, monto: Number(remitoIni.saldo) }] : []);

  const opcionesClientes = useMemo(
    () => clientes.map((c) => ({ value: c.id, label: c.nombre, sub: c.localidad ?? undefined, keywords: [c.cuit, c.telefono].filter(Boolean).join(" ") })),
    [clientes]
  );
  const remitosCliente = useMemo(() => remitos.filter((r) => r.cliente_id === clienteId).sort((a, b) => a.numero - b.numero), [remitos, clienteId]);
  const montoNum = parseFloat(monto.replace(",", ".")) || 0;
  const asignado = asignaciones.reduce((a, x) => a + x.monto, 0);
  const deMas = asignado > montoNum + 0.009;

  function elegirCliente(id: string) {
    setClienteId(id);
    setAsignaciones([]);
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await crearPago({ cliente_id: clienteId, monto: montoNum, medio, referencia, observaciones, imputaciones: asignaciones });
      if (res.ok) {
        const aCuenta = montoNum - asignado;
        router.push(`/clientes/${clienteId}?ok=` + encodeURIComponent(aCuenta > 0.009 ? `Pago registrado. ${formatoMoneda(aCuenta)} quedaron a cuenta para imputar después.` : "Pago registrado e imputado."));
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {error && <div className="alert-error">{error}</div>}
      <div className="card grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="label">Cliente *</label>
          <Combobox opciones={opcionesClientes} value={clienteId} onChange={elegirCliente} placeholder="Nombre, CUIT o teléfono…" autoFocus={!clienteId} />
        </div>
        <div>
          <label className="label">Fecha</label>
          <div className="input" style={{ background: "#f3f4f6" }}>{formatoFecha(hoyISO())}</div>
        </div>
        <div>
          <label className="label">Monto del pago *</label>
          <input className="input num" type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <label className="label">Medio de pago</label>
          <select className="select" value={medio} onChange={(e) => setMedio(e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cheque">Cheque</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="label">Referencia</label>
          <input className="input" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° operación, cheque…" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Observaciones</label>
          <input className="input" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-1">¿A qué remitos corresponde?</h2>
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          Tildá los remitos que paga (o escribí cuánto va a cada uno). Lo que no asignes queda a cuenta del cliente y lo podés imputar más adelante.
        </p>
        {clienteId ? (
          <ImputacionTabla remitos={remitosCliente} asignaciones={asignaciones} onChange={setAsignaciones} disponible={montoNum} />
        ) : (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Elegí primero el cliente.</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={pending || !clienteId || montoNum <= 0 || deMas} onClick={guardar}>
          {pending ? "Guardando…" : "Registrar pago"}
        </button>
        {deMas && <span className="text-sm" style={{ color: "var(--danger)" }}>Lo asignado supera el monto del pago.</span>}
      </div>
    </div>
  );
}
