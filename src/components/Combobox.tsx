"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface Opcion {
  value: string;
  label: string;
  sub?: string;      // texto secundario (código, saldo, etc.)
  keywords?: string; // texto extra para buscar (código, cuit...)
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function Combobox({
  opciones,
  value,
  onChange,
  placeholder = "Escribí para buscar…",
  name,
  disabled,
  autoFocus,
}: {
  opciones: Opcion[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const seleccionada = opciones.find((o) => o.value === value);
  const [texto, setTexto] = useState(seleccionada?.label ?? "");
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  // Si cambia el valor desde afuera, reflejar el label
  useEffect(() => {
    setTexto(seleccionada?.label ?? "");
  }, [seleccionada?.label, value]);

  const filtradas = useMemo(() => {
    const q = normalizar(texto.trim());
    if (!q || (seleccionada && texto === seleccionada.label)) return opciones.slice(0, 50);
    const palabras = q.split(/\s+/);
    return opciones
      .filter((o) => {
        const hay = normalizar(o.label + " " + (o.sub ?? "") + " " + (o.keywords ?? ""));
        return palabras.every((p) => hay.includes(p));
      })
      .slice(0, 50);
  }, [texto, opciones, seleccionada]);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
        setTexto(seleccionada?.label ?? "");
      }
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [seleccionada]);

  useEffect(() => {
    const el = listaRef.current?.children[indice] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  function elegir(o: Opcion) {
    onChange(o.value);
    setTexto(o.label);
    setAbierto(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "Enter")) { setAbierto(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setIndice((i) => Math.min(i + 1, filtradas.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndice((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtradas[indice]) elegir(filtradas[indice]); }
    else if (e.key === "Escape") { setAbierto(false); setTexto(seleccionada?.label ?? ""); }
  }

  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <div className="relative">
        <input
          className="input pr-8"
          value={texto}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setIndice(0); if (value) onChange(""); }}
          onFocus={() => { setAbierto(true); setIndice(0); }}
          onKeyDown={onKey}
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label="Limpiar"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: "var(--muted)" }}
            onClick={() => { onChange(""); setTexto(""); setAbierto(true); }}
          >✕</button>
        )}
      </div>
      {abierto && !disabled && (
        <ul
          ref={listaRef}
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg shadow-lg"
          style={{ background: "#fff", border: "1px solid var(--border)" }}
        >
          {filtradas.length === 0 && <li className="px-3 py-2 text-sm" style={{ color: "var(--muted)" }}>Sin resultados</li>}
          {filtradas.map((o, i) => (
            <li
              key={o.value}
              className="px-3 py-2 text-sm cursor-pointer flex justify-between gap-3"
              style={{ background: i === indice ? "#eef3ff" : undefined }}
              onMouseEnter={() => setIndice(i)}
              onMouseDown={(e) => { e.preventDefault(); elegir(o); }}
            >
              <span className={o.value === value ? "font-semibold" : ""}>{o.label}</span>
              {o.sub && <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>{o.sub}</span>}
            </li>
          ))}
          {opciones.length > 50 && filtradas.length === 50 && (
            <li className="px-3 py-1 text-xs" style={{ color: "var(--muted)" }}>Mostrando 50 · seguí escribiendo para afinar</li>
          )}
        </ul>
      )}
    </div>
  );
}
