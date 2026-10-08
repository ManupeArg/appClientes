export default function EstadoPagoBadge({ estado }: { estado: string }) {
  const map: Record<string, { cls: string; txt: string }> = {
    pendiente: { cls: "badge-warn", txt: "pendiente" },
    parcial: { cls: "badge-info", txt: "pago parcial" },
    pagado: { cls: "badge-ok", txt: "pagado" },
    anulado: { cls: "badge-danger", txt: "anulado" },
  };
  const m = map[estado] ?? { cls: "badge-muted", txt: estado };
  return <span className={"badge " + m.cls}>{m.txt}</span>;
}
