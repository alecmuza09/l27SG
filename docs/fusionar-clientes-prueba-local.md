# Probar fusión de clientes (rama `feature/fusionar-clientes`)

## Activar en Supabase

Antes de usar el botón en la app, ejecuta el SQL del repo en tu proyecto Supabase:

- Archivo: [`supabase/rpc-fusionar-clientes.sql`](../supabase/rpc-fusionar-clientes.sql)
- Supabase Dashboard → SQL Editor → pegar y ejecutar

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
