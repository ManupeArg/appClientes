# MSP · Cambios versión 2 (octubre 2026)

## Cómo aplicar la actualización

1. **Base de datos**: Supabase → SQL Editor → New query → pegar TODO `supabase/migration_002.sql` → Run.
   Se corre una sola vez. Además de los cambios, reactiva los productos y clientes que habían quedado ocultos por el bug de "Guardar cambios".
2. **Código**: reemplazar la carpeta del proyecto por esta versión (o copiar `src/`, `supabase/`, `README.md` y este archivo encima) y subir a GitHub:
   ```bash
   git add .
   git commit -m "MSP v2: unidades de negocio, pagos por remito, enteros, buscador"
   git push
   ```
   Vercel hace el deploy solo.
3. **Después del deploy**, en MSP:
   - Configuración → verificar que las unidades *Insecticida* (lo de Fernando) y *Limpieza* (de los dos) estén bien (podés renombrarlas, cambiar color o agregar otras).
   - Productos → aparece un aviso con los productos sin unidad. Filtrás por categoría o nombre, "Seleccionar todo el listado", elegís la unidad y "Asignar unidad". Repetir hasta que no quede ninguno.
   - Configuración → botón "Recalcular cuenta corriente" para que los remitos y pagos viejos se repartan según la unidad de sus productos.

## Qué cambió

- **Bug corregido**: al guardar un producto o cliente se marcaba como inactivo y desaparecía del listado. Ya no pasa, y la migración reactiva todo.
- **Buscador por texto** para clientes y productos en remitos y pagos: escribís parte del nombre, código, CUIT o teléfono y filtra. Flechas + Enter para elegir.
- **Unidades de negocio** ("dos empresas en una"): cada **producto** pertenece a una unidad. Un remito puede mezclar productos de las dos; la cuenta corriente se parte sola: el importe de cada unidad va a su propia cuenta (si hay descuento, se reparte proporcional). Inicio, clientes, remitos, pagos y cuenta corriente muestran los números separados por unidad y con filtro.
- **Pagos a un remito**: el pago se aplica a un remito puntual, no al cliente en general. No se puede pagar más de lo pendiente de ese remito. Si el remito tiene productos de las dos unidades, el pago se reparte entre las dos en la misma proporción que la venta. Cada remito muestra pagado / pendiente y su estado. Para anular un remito con pagos, primero se anulan los pagos.
- **Cantidades enteras**: cantidades de remito, stock, stock mínimo y ajustes son números enteros.
- **Fechas automáticas**: remitos y pagos toman la fecha de hoy (hora Argentina) y no se pueden editar.
- Los pagos viejos que se habían cargado "al cliente" (sin remito) quedan en la cuenta corriente como "pago a cuenta" y en el saldo "Sin unidad".
