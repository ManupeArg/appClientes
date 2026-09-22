export default function PageHeader({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        {subtitulo && <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{subtitulo}</p>}
      </div>
      {children && <div className="flex gap-2 no-print">{children}</div>}
    </div>
  );
}
