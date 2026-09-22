import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarAlertaStock } from "@/lib/email";

export const dynamic = "force-dynamic";

// Se llama todos los días desde el cron de Vercel (ver vercel.json) o manualmente:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/cron/stock-bajo
// ?force=1 envía aunque hoy ya se haya mandado (lo usa el botón "Enviar ahora").
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const supabase = createAdminClient();

  const { data: config } = await supabase.from("configuracion").select("valor").eq("clave", "alertas_stock").single();
  const alertas = (config?.valor ?? {}) as { emails?: string[]; activo?: boolean };
  const destinatarios = alertas.emails ?? [];

  if (!alertas.activo) return NextResponse.json({ enviado: false, mensaje: "Las alertas están desactivadas en Configuración" });
  if (destinatarios.length === 0) return NextResponse.json({ enviado: false, mensaje: "No hay destinatarios cargados en Configuración" });

  const { data: productos, error } = await supabase.from("productos_stock_bajo").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!productos?.length) return NextResponse.json({ enviado: false, mensaje: "No hay productos con stock bajo. No se envió nada." });

  if (!force) {
    // Evitar mandar dos veces el mismo día si el cron se dispara más de una vez
    const hoy = new Date().toISOString().slice(0, 10);
    const { data: ya } = await supabase.from("alertas_enviadas").select("id").eq("ok", true).gte("enviado_en", hoy + "T00:00:00Z").limit(1);
    if (ya?.length) return NextResponse.json({ enviado: false, mensaje: "Hoy ya se envió la alerta" });
  }

  try {
    const res = await enviarAlertaStock(destinatarios, productos);
    if (res.error) throw new Error(res.error.message);
    await supabase.from("alertas_enviadas").insert({ destinatarios, productos, ok: true });
    return NextResponse.json({ enviado: true, mensaje: `Alerta enviada a ${destinatarios.join(", ")} (${productos.length} productos)` });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("alertas_enviadas").insert({ destinatarios, productos, ok: false, error: msg });
    return NextResponse.json({ error: "Error al enviar el mail: " + msg }, { status: 500 });
  }
}
