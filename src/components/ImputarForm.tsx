"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ImputacionTabla, { type Asignacion } from "@/components/ImputacionTabla";
import { imputarPago } from "@/lib/actions/pagos";
import type { RemitoSaldo } from "@/lib/types";

export default function ImputarForm({ pagoId, clienteId, remitos, disponible }: { pagoId: string; clienteId: string; remitos: RemitoSaldo[]; disponible: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const asignado = asignaciones.reduce((a, x) => a + x.monto, 0);
  const deMas = asignado > disponible + 0.009;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await imputarPago(pagoId, asignaciones);
      if (res.ok) router.push(`/clientes/${clienteId}?ok=` + encodeURIComponent("Pago imputado"));
      else setError(res.error);
    });
  }

  return (
    <div className="card space-y-3 max-w-4xl">
      {error && <div className="alert-error">{error}</div>}
      <ImputacionTabla remitos={remitos} asignaciones={asignaciones} onChange={setAsignaciones} disponible={disponible} />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={pending || asignado <= 0 || deMas} onClick={guardar}>{pending ? "Guardando…" : "Imputar"}</button>
        {deMas && <span className="text-sm" style={{ color: "var(--danger)" }}>Supera lo disponible del pago.</span>}
      </div>
    </div>
  );
}
