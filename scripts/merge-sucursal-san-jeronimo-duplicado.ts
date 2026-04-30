/**
 * Fusiona la sucursal duplicada identificada por correo `sanjeronimo2@luna27.mx`
 * hacia la sucursal original `sanjeronimo@luna27.mx`: reapunta citas, pagos,
 * empleados (deduplicados por email), inventario, gift cards, periodos bloqueados,
 * usuario_sucursales y bloques de agenda; luego borra la fila duplicada en `sucursales`.
 *
 * Opcionalmente elimina el usuario Auth + fila `usuarios` del manager duplicado
 * (`ELIMINAR_MANAGER_EMAIL`).
 *
 * Requisitos: `.env.local` con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 *
 * Uso:
 *   pnpm tsx scripts/merge-sucursal-san-jeronimo-duplicado.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import { resolve } from "path"

dotenv.config({ path: resolve(process.cwd(), ".env.local") })

const KEEP_EMAIL = "sanjeronimo@luna27.mx"
const DROP_EMAIL = "sanjeronimo2@luna27.mx"
/** Usuario manager duplicado a quitar tras la fusión (mismo correo que la sucursal duplicada). */
const ELIMINAR_MANAGER_EMAIL = "sanjeronimo2@luna27.mx"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: keep, error: eKeep } = await supabase
    .from("sucursales")
    .select("id, nombre, email")
    .eq("email", KEEP_EMAIL)
    .maybeSingle()

  const { data: drop, error: eDrop } = await supabase
    .from("sucursales")
    .select("id, nombre, email")
    .eq("email", DROP_EMAIL)
    .maybeSingle()

  if (eKeep || !keep?.id) {
    console.error(`❌ No se encontró sucursal canon ${KEEP_EMAIL}:`, eKeep?.message ?? "sin fila")
    process.exit(1)
  }
  if (eDrop || !drop?.id) {
    console.log(`ℹ️  No hay sucursal con email ${DROP_EMAIL}; nada que fusionar.`)
    process.exit(0)
  }

  const KEEP_ID = keep.id as string
  const DROP_ID = drop.id as string

  if (KEEP_ID === DROP_ID) {
    console.error("❌ KEEP y DROP tienen el mismo id; abortando.")
    process.exit(1)
  }

  console.log(`\n📌 KEEP  (${KEEP_EMAIL}): ${KEEP_ID} — ${keep.nombre}`)
  console.log(`📌 DROP (${DROP_EMAIL}): ${DROP_ID} — ${drop.nombre}`)

  // ─── Empleados: mismo email → unificar FKs al empleado de KEEP ─────────────────
  const { data: dropEmps, error: errDropEmps } = await supabase
    .from("empleados")
    .select("id, email")
    .eq("sucursal_id", DROP_ID)

  if (errDropEmps) {
    console.error("❌ Error leyendo empleados DROP:", errDropEmps.message)
    process.exit(1)
  }

  for (const emp of dropEmps ?? []) {
    const emailNorm = (emp.email ?? "").trim().toLowerCase()
    const { data: twin } = await supabase
      .from("empleados")
      .select("id")
      .eq("sucursal_id", KEEP_ID)
      .ilike("email", emailNorm)
      .maybeSingle()

    if (twin?.id) {
      await supabase.from("citas").update({ empleado_id: twin.id }).eq("empleado_id", emp.id)
      await supabase.from("pagos").update({ empleado_id: twin.id }).eq("empleado_id", emp.id)
      await supabase.from("gift_cards").update({ empleado_emisor_id: twin.id }).eq("empleado_emisor_id", emp.id)
      const { error: delE } = await supabase.from("empleados").delete().eq("id", emp.id)
      if (delE) console.warn(`   ⚠️ No se pudo borrar empleado duplicado ${emp.id}: ${delE.message}`)
      else console.log(`   ✅ Empleado ${emailNorm}: citas/pagos → KEEP; duplicado eliminado`)
    } else {
      const { error: upE } = await supabase.from("empleados").update({ sucursal_id: KEEP_ID }).eq("id", emp.id)
      if (upE) console.warn(`   ⚠️ Empleado ${emp.id}: ${upE.message}`)
      else console.log(`   ✅ Empleado ${emailNorm}: sucursal → KEEP`)
    }
  }

  const tablesSimpleSucursal: Array<{ table: string; optional?: boolean }> = [
    { table: "citas" },
    { table: "pagos" },
    { table: "gift_cards" },
    { table: "periodos_bloqueados" },
    { table: "agenda_bloques", optional: true },
  ]

  for (const { table, optional } of tablesSimpleSucursal) {
    if (table === "agenda_bloques") {
      try {
        const { data: rowsDrop, error: selErr } = await supabase
          .from("agenda_bloques")
          .select("fecha, bloques")
          .eq("sucursal_id", DROP_ID)
        if (selErr) throw selErr
        for (const row of rowsDrop ?? []) {
          const fecha = row.fecha as string
          const { data: existing } = await supabase
            .from("agenda_bloques")
            .select("bloques")
            .eq("sucursal_id", KEEP_ID)
            .eq("fecha", fecha)
            .maybeSingle()
          const a = Array.isArray(existing?.bloques) ? existing!.bloques : []
          const b = Array.isArray(row.bloques) ? row.bloques : []
          const merged = [...a, ...b]
          const { error } = await supabase.from("agenda_bloques").upsert(
            {
              sucursal_id: KEEP_ID,
              fecha,
              bloques: merged,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "sucursal_id,fecha" },
          )
          if (error) console.warn(`   ⚠️ agenda_bloques ${fecha}: ${error.message}`)
        }
        await supabase.from("agenda_bloques").delete().eq("sucursal_id", DROP_ID)
        console.log("   ✅ agenda_bloques fusionados")
      } catch (e: unknown) {
        console.warn(
          "   ⚠️ agenda_bloques omitido (tabla ausente o error):",
          e instanceof Error ? e.message : e,
        )
      }
      continue
    }

    const { error } = await supabase.from(table).update({ sucursal_id: KEEP_ID }).eq("sucursal_id", DROP_ID)
    if (error) {
      if (optional) console.warn(`   ⚠️ ${table}: ${error.message}`)
      else {
        console.error(`❌ ${table}:`, error.message)
        process.exit(1)
      }
    } else {
      console.log(`   ✅ ${table}: sucursal_id DROP → KEEP`)
    }
  }

  // Inventario: conflicto de SKU entre sucursales
  const { data: dropSku } = await supabase.from("inventario_productos").select("sku").eq("sucursal_id", DROP_ID)
  const { data: keepSku } = await supabase.from("inventario_productos").select("sku").eq("sucursal_id", KEEP_ID)
  const keepSet = new Set((keepSku ?? []).map((r: { sku: string }) => r.sku))
  const collisions = (dropSku ?? []).filter((r: { sku: string }) => keepSet.has(r.sku))
  if (collisions.length > 0) {
    console.warn(
      `\n⚠️  Hay ${collisions.length} SKU duplicados entre sucursales; resuélvelos antes de mover inventario.`,
      collisions.slice(0, 10),
    )
    process.exit(1)
  }

  const { error: invErr } = await supabase
    .from("inventario_productos")
    .update({ sucursal_id: KEEP_ID })
    .eq("sucursal_id", DROP_ID)
  if (invErr) console.warn(`   ⚠️ inventario_productos: ${invErr.message}`)
  else console.log("   ✅ inventario_productos: sucursal_id DROP → KEEP")

  await supabase
    .from("inventario_movimientos")
    .update({ sucursal_origen: KEEP_ID })
    .eq("sucursal_origen", DROP_ID)
  await supabase
    .from("inventario_movimientos")
    .update({ sucursal_destino: KEEP_ID })
    .eq("sucursal_destino", DROP_ID)

  await supabase.from("clientes").update({ sucursal_preferida: KEEP_ID }).eq("sucursal_preferida", DROP_ID)
  await supabase.from("usuarios").update({ sucursal_id: KEEP_ID }).eq("sucursal_id", DROP_ID)

  await supabase.from("usuario_sucursales").delete().eq("sucursal_id", DROP_ID)

  console.log(
    `\n📎 Si usas promociones por sucursal, ejecuta en SQL (reemplaza UUID):\n` +
      `UPDATE promociones SET sucursales_aplicables = array_replace(sucursales_aplicables, '${DROP_ID}'::uuid, '${KEEP_ID}'::uuid)\n` +
      `WHERE '${DROP_ID}'::uuid = ANY(sucursales_aplicables);\n`,
  )

  const { error: delSuc } = await supabase.from("sucursales").delete().eq("id", DROP_ID)
  if (delSuc) {
    console.error("❌ No se pudo borrar sucursal DROP:", delSuc.message)
    process.exit(1)
  }
  console.log("\n✅ Sucursal duplicada eliminada.")

  // Manager duplicado (Auth + usuarios)
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authUser = authList?.users?.find(u => (u.email ?? "").toLowerCase() === ELIMINAR_MANAGER_EMAIL.toLowerCase())
  if (authUser) {
    const { error: au } = await supabase.auth.admin.deleteUser(authUser.id)
    if (au) console.warn("⚠️ Auth delete:", au.message)
    else console.log(`✅ Usuario Auth eliminado: ${ELIMINAR_MANAGER_EMAIL}`)
  }
  await supabase.from("usuarios").delete().eq("email", ELIMINAR_MANAGER_EMAIL)
  console.log(`✅ Tabla usuarios limpiada para ${ELIMINAR_MANAGER_EMAIL} (si existía).\n`)
}

main().catch(err => {
  console.error("❌ Error fatal:", err)
  process.exit(1)
})
