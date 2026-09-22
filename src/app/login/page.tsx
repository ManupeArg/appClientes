import Link from "next/link";
import { login } from "@/lib/actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl font-black tracking-tight" style={{ color: "var(--primary)" }}>MSP</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Ingresá a tu cuenta</div>
        </div>
        {sp.error && <div className="alert-error mb-4">{sp.error}</div>}
        {sp.ok && <div className="alert-ok mb-4">{sp.ok}</div>}
        <form action={login} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn btn-primary w-full justify-center" type="submit">Ingresar</button>
        </form>
        <p className="mt-4 text-center text-sm" style={{ color: "var(--muted)" }}>
          ¿No tenés cuenta? <Link className="underline" href="/registro">Registrate</Link>
        </p>
      </div>
    </div>
  );
}
