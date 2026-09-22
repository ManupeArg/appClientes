import { Resend } from "resend";

interface ProductoBajo {
  id: string;
  codigo: string | null;
  nombre: string;
  unidad: string;
  stock: number;
  stock_minimo: number;
}

export async function enviarAlertaStock(destinatarios: string[], productos: ProductoBajo[]) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const app = process.env.NEXT_PUBLIC_APP_URL || "";
  const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const filas = productos
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px">${p.codigo ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><a href="${app}/productos/${p.id}" style="color:#1f5eff;text-decoration:none">${p.nombre}</a></td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#d7263d;font-weight:700">${Number(p.stock)} ${p.unidad}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${Number(p.stock_minimo)}</td>
      </tr>`
    )
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1a2233">
    <div style="padding:20px 0 12px">
      <div style="font-size:22px;font-weight:900;color:#1f5eff">MSP</div>
      <div style="font-size:13px;color:#6b7280">Aviso de stock bajo · ${fecha}</div>
    </div>
    <p>Hay <strong>${productos.length}</strong> producto${productos.length === 1 ? "" : "s"} en el mínimo o por debajo:</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
      <thead>
        <tr style="background:#f4f6f8;font-size:12px;text-transform:uppercase;color:#6b7280">
          <th style="padding:8px 12px;text-align:left">Código</th>
          <th style="padding:8px 12px;text-align:left">Producto</th>
          <th style="padding:8px 12px;text-align:right">Stock</th>
          <th style="padding:8px 12px;text-align:right">Mínimo</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    ${app ? `<p style="margin-top:20px"><a href="${app}/productos?bajo=1" style="background:#1f5eff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Ver en MSP</a></p>` : ""}
    <p style="font-size:12px;color:#6b7280;margin-top:24px">Recibís este aviso porque tu email está cargado en Configuración → Alertas de stock. Podés cambiar el mínimo de cada producto desde su ficha.</p>
  </div>`;

  const texto =
    `MSP · Aviso de stock bajo (${fecha})\n\n` +
    productos.map((p) => `- ${p.nombre}: ${Number(p.stock)} ${p.unidad} (mínimo ${Number(p.stock_minimo)})`).join("\n");

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "MSP <onboarding@resend.dev>",
    to: destinatarios,
    subject: `⚠️ MSP: ${productos.length} producto${productos.length === 1 ? "" : "s"} con stock bajo`,
    html,
    text: texto,
  });
}
