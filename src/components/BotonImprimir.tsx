"use client";

export default function BotonImprimir() {
  return <button type="button" className="btn btn-secondary" onClick={() => window.print()}>🖨 Imprimir / PDF</button>;
}
