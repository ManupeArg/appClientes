"use client";

import EstadoPagoBadge from "@/components/EstadoPagoBadge";
import { formatoMoneda, formatoFecha, numeroRemito } from "@/lib/utils";
import type { RemitoSaldo } from "@/lib/types";

export interface Asignacion {
  remito_id: string;
  monto: number;
}

// Tabla de remitos pendientes con un campo de importe por cada uno
export default function ImputacionTabla({
  remitos,
  asignaciones,
  onChange,
  disponible,
}: {
  remitos: RemitoSaldo[];
  asignaciones: Asignacion[];
  onChange: (a: Asignacion[]) => void;
  disponible: number; // monto del pago (o lo que queda a cuenta)
}) {
  const montoDe = (id: string) => asignaciones.find((a) => a.remito_id === id)?.monto ?? 0;
  const asignado = asignaciones.reduce((a, x) => a + x.monto, 0);

  function setMonto(id: string, monto: number, max: number) {
    const m = Math.max(0, Math.min(monto, max));
    onChange([...asignaciones.filter((a) => a.remito_id !== id), ...(m > 0 ? [{ remito_id: id, monto: Math.round(m * 100) / 100 }] : [])]);
  }

  function toggle(r: RemitoSaldo) {
    if (montoDe(r.id) > 0) setMonto(r.id, 0, r.saldo);
    else {
      const resto = Math.max(0, disponible - asignado);
      setMonto(r.id, Math.min(Number(r.saldo), resto), Number(r.saldo));
    }
  }

  function automatico() {
    // más viejos primero (vencidos primero), hasta agotar el disponible
    let resto = disponible;
    const orden = [...remitos].sort((a, b) => (a.vencido === b.vencido ? a.numero - b.numero : a.vencido ? -1 : 1));
    const nuevas: Asignacion[] = [];
    for (const r of orden) {
      if (resto <= 0) break;
      const m = Math.min(Number(r.saldo), resto);
      if (m > 0) { nuevas.push({ remito_id: r.id, monto: Math.round(m * 100) / 100 }); resto -= m; }
    }
    onChange(nuevas);
  }

  const resto = disponible - asignado;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-sm">
          Asignado <strong>{formatoMoneda(asignado)}</strong> ·{" "}
          {resto > 0.009 ? <span>queda <strong style={{ color: "var(--warn)" }}>{formatoMoneda(resto)}</strong> a cuenta</span>
            : resto < -0.009 ? <span style={{ color: "var(--danger)" }}>asignaste {formatoMoneda(-resto)} de más</span>
            : <span style={{ color: "var(--ok)" }}>todo asignado</span>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={automatico} disabled={disponible <= 0}>Repartir automático (más viejos primero)</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([])}>Limpiar</button>
        </div>
      </div>
      <table className="table">
        <thead><tr><th></th><th>Remito</th><th>Fecha</th><th>Vence</th><th className="num">Pendiente</th><th className="num" style={{ width: 150 }}>Imputar</th></tr></thead>
        <tbody>
          {remitos.map((r) => {
            const m = montoDe(r.id);
            return (
              <tr key={r.id} style={{ background: m > 0 ? "#f3f7ff" : undefined }}>
                <td><input type="checkbox" checked={m > 0} onChange={() => toggle(r)} /></td>
                <td className="font-medium">{numeroRemito(r.numero)} <EstadoPagoBadge estado={r.estado_pago} /></td>
                <td>{formatoFecha(r.fecha)}</td>
                <td>{r.vencimiento ? formatoFecha(r.vencimiento) : "—"} {r.vencido && <span className="badge badge-danger ml-1">vencido</span>}</td>
                <td className="num font-semibold">{formatoMoneda(r.saldo)}</td>
                <td>
                  <input
                    className="input num"
                    type="number"
                    min="0"
                    step="0.01"
                    max={Number(r.saldo)}
                    value={m || ""}
                    placeholder="0"
                    onChange={(e) => setMonto(r.id, parseFloat(e.target.value) || 0, Number(r.saldo))}
                  />
                </td>
              </tr>
            );
          })}
          {!remitos.length && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>Este cliente no tiene remitos pendientes: el pago queda a cuenta.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
