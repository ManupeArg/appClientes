import Link from "next/link";
import { registro } from "@/lib/actions/auth";

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl font-black tracking-tight" style={{ color: "var(--primary)" }}>MSP</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Crear cuenta</div>
        </div>
        {sp.error && <div className="alert-error mb-4">{sp.error}</div>}
        <form action={registro} className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input" name="nombre" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" name="email" type="email" required />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input" name="password" type="password" required minLength={6} />
          </div>
          <button className="btn btn-primary w-full justify-center" type="submit">Crear cuenta</button>
        </form>
        <p className="mt-4 text-center text-xs" style={{ color: "var(--muted)" }}>
          El primer usuario registrado queda como administrador. Los siguientes entran como vendedores hasta que el admin les cambie el rol.
        </p>
        <p className="mt-2 text-center text-sm" style={{ color: "var(--muted)" }}>
          ¿Ya tenés cuenta? <Link className="underline" href="/login">Ingresá</Link>
        </p>
      </div>
    </div>
  );
}
