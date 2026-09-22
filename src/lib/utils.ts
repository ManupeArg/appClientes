export function formatoMoneda(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

export function formatoNumero(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function formatoFecha(f: string | Date | null | undefined) {
  if (!f) return "";
  const d = typeof f === "string" ? new Date(f.length === 10 ? f + "T00:00:00" : f) : f;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function hoyISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function numeroRemito(n: number) {
  return "R-" + String(n).padStart(6, "0");
}
