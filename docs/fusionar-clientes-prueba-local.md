# Probar fusión de clientes (rama `feature/fusionar-clientes`)

## Activar en Supabase (obligatorio)

Si ves *Could not find the function public.preview_fusion_clientes … in the schema cache*, es porque **este SQL no se ha ejecutado** en el mismo proyecto que apunta tu `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`).

1. Abre [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto Luna27 → **SQL Editor**.
2. Copia **todo** [`supabase/rpc-fusionar-clientes.sql`](../supabase/rpc-fusionar-clientes.sql) y pulsa **Run**.
3. Si falla con `user_is_global_admin() does not exist`, ejecuta antes las funciones RLS de [`supabase/restringir-scope-sucursal-rls-y-paseotecnat.sql`](../supabase/restringir-scope-sucursal-rls-y-paseotecnat.sql) (o al menos la parte de `user_is_global_admin`).
4. Espera unos segundos y recarga la app (PostgREST actualiza el “schema cache”).

El orden `(p_drop, p_drop)` en el mensaje de error es normal: PostgREST ordena los parámetros alfabéticamente; lo importante es que la función exista.

## Probar en local

1. `git checkout feature/fusionar-clientes`
2. Aplica el SQL anterior en Supabase (mismo proyecto que usa `.env.local`).
3. `pnpm dev` (o el comando habitual).
4. Entra como **admin global** → Clientes → abre una ficha → **Fusionar con otra**.

## Si no te gusta el cambio (volver atrás)

**Solo código (sin tocar main remoto):**

```bash
git checkout main
git branch -D feature/fusionar-clientes
```

`main` queda como antes del experimento. Las fusiones ya hechas en Supabase **no** se deshacen solas (queda auditoría en `clientes_fusiones`).

**Descartar cambios sin borrar la rama:**

```bash
git checkout main
git branch -D feature/fusionar-clientes   # opcional
```
