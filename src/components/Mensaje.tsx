export default function Mensaje({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <div className="alert-error mb-4">{error}</div>;
  if (ok) return <div className="alert-ok mb-4">{ok}</div>;
  return null;
}
