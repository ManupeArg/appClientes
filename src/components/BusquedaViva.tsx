"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Campo de búsqueda que filtra el listado mientras se escribe (actualiza ?q= con una pequeña espera)
export default function BusquedaViva({ placeholder = "Buscar…", param = "q", className = "input max-w-sm" }: { placeholder?: string; param?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(searchParams.get(param) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primera = useRef(true);

  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      if (texto.trim()) p.set(param, texto.trim()); else p.delete(param);
      router.replace(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className="relative" style={{ minWidth: 260 }}>
      <input
        className={className}
        value={texto}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
      />
      {texto && (
        <button type="button" aria-label="Limpiar" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }} onClick={() => setTexto("")}>✕</button>
      )}
    </div>
  );
}
