# MSP · Gestión comercial

Sistema web para cargar clientes, productos (precio minorista y mayorista), emitir remitos que descuentan stock automáticamente, registrar pagos, ver la cuenta corriente de cada cliente y recibir por mail un aviso diario de los productos con stock bajo.

Stack: **Next.js 15** (App Router) · **Supabase** (Postgres + Auth) · **Resend** (mails) · Tailwind CSS. Pensado para deploy en **Vercel** (el cron diario usa Vercel Cron).

---

## 1. Puesta en marcha (una sola vez)

### a) Supabase

1. Entrá a [supabase.com](https://supabase.com) → **New project** (elegí región `South America (São Paulo)`). Guardá la contraseña de la base.
2. Cuando termine de crearse, andá a **SQL Editor → New query**, pegá TODO el contenido de `supabase/schema.sql` y apretá **Run**. Eso crea tablas, triggers, vistas y permisos.
3. En **Authentication → Providers → Email** dejá habilitado *Email*. Si querés entrar sin confirmar el mail (más cómodo para arrancar), desactivá *Confirm email*.
4. En **Project Settings → API** copiá: `Project URL`, `anon public` key y `service_role` key.

### b) Resend (mails de alerta)

1. Creá una cuenta en [resend.com](https://resend.com) → **API Keys → Create**. Copiá la key (`re_...`).
2. Para probar podés enviar desde `onboarding@resend.dev` **solo a tu propio mail de Resend**. Para mandar a cualquier casilla tenés que agregar tu dominio en **Domains** y usar un remitente de ese dominio (ej. `alertas@tuempresa.com`).

### c) Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=re_...
EMAIL_FROM="MSP <alertas@tuempresa.com>"
CRON_SECRET=una-clave-larga-inventada
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### d) Correr en tu compu

```bash
npm install
npm run dev
```

Abrí http://localhost:3000, andá a **Registrate** y creá tu usuario. **El primer usuario que se registra queda como administrador**; los que se registren después entran como *vendedor* hasta que vos les cambies el rol en *Configuración*.

---

## 2. Cómo se usa

| Sección | Qué hacés |
|---|---|
| **Clientes** | Alta de clientes con su lista de precios por defecto (minorista/mayorista). Al entrar a un cliente ves su **cuenta corriente**: cada remito suma al *Debe*, cada pago al *Haber*, y el saldo te dice cuánto te debe. |
| **Productos** | Código, nombre, 2 precios, costo (opcional), unidad, stock mínimo y si querés recibir alerta. Desde la ficha cargás ingresos de mercadería o ajustes de inventario; queda el historial de movimientos. |
| **Remitos** | Elegís cliente → se preselecciona su lista de precios (podés cambiarla). Agregás productos, cantidades, descuento y observaciones. Al emitirlo: **baja el stock** y **se carga en la cuenta corriente**. Se imprime / guarda como PDF con el botón *Imprimir*. Si te equivocaste, *Anular* devuelve el stock y revierte la cuenta corriente (queda todo registrado, nada se borra). |
| **Pagos** | Registrás cobros (efectivo, transferencia, tarjeta, cheque) contra un cliente. Se pueden anular desde la cuenta corriente. |
| **Configuración** | Datos del negocio (van en el encabezado del remito), **destinatarios de las alertas de stock**, botón *Enviar alerta ahora* para probar, historial de envíos y administración de usuarios (rol admin/vendedor, activar/desactivar). |

### Alerta de stock bajo

Todos los días a las **8:00 (hora Argentina)** el sistema revisa los productos con `stock ≤ stock mínimo` (solo los que tienen la alerta activada) y manda un solo mail con la lista a los destinatarios cargados en Configuración. Si no hay ningún producto bajo, no manda nada. No se envía dos veces el mismo día.

Localmente podés dispararla a mano:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" "http://localhost:3000/api/cron/stock-bajo?force=1"
```

---

## 3. Deploy en Vercel (para usarlo desde cualquier lado)

1. Subí la carpeta a un repo de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importá el repo.
3. En *Environment Variables* cargá las mismas variables de `.env.local`, cambiando `NEXT_PUBLIC_APP_URL` por la URL que te da Vercel (ej. `https://msp.vercel.app`).
4. Deploy. El archivo `vercel.json` ya define el cron diario (`0 11 * * *` en UTC = 8:00 en Argentina). Vercel manda automáticamente el header `Authorization: Bearer CRON_SECRET`, así que con tener la variable cargada alcanza.
5. En Supabase → **Authentication → URL Configuration** agregá la URL de Vercel como *Site URL*.

> Plan gratis de Vercel: los crons corren una vez por día como máximo, justo lo que necesitamos.

---

## 4. Estructura del proyecto

```
supabase/schema.sql        ← toda la base: tablas, triggers, vistas, RLS
src/app/(app)/             ← pantallas (inicio, clientes, productos, remitos, pagos, configuración)
src/app/api/cron/stock-bajo← endpoint que manda la alerta
src/lib/actions/           ← server actions (altas, ediciones, anulaciones)
src/lib/email.ts           ← plantilla del mail
src/components/            ← formularios y piezas de UI
vercel.json                ← cron diario
```

### Reglas de negocio que viven en la base (triggers)

- Insertar un ítem de remito → descuenta stock y registra el movimiento.
- Cambia el total de un remito → se actualiza su renglón en la cuenta corriente.
- Remito pasa a *anulado* → devuelve el stock y genera un contra-asiento en la cuenta corriente.
- Insertar un pago → suma al *Haber*; anular un pago → contra-asiento.
- `crear_remito(...)` arma todo el remito en una sola transacción (o se guarda todo o nada).

Gracias a esto, aunque en el futuro cargues datos desde otra herramienta o script, el stock y la cuenta corriente siempre quedan consistentes.

---

## 5. Ideas para después

- Facturación electrónica AFIP (hoy el remito aclara "no válido como factura").
- Exportar cuenta corriente / listados a Excel.
- Presupuestos que se convierten en remito.
- Lista de precios masiva: aumentar X % a toda una categoría.
- Enviar el remito por mail o WhatsApp al cliente.
- Aviso automático al cliente cuando su saldo supera cierto monto.
