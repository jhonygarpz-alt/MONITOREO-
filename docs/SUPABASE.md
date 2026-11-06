# Publicación con Supabase + Render

## 1. Base de datos — Supabase (YA CREADA)
- Organización: **OPTIMA SOLUTIONS** (plan Pro)
- Proyecto propio: **centro-inteligente-monitoreo** (`rpsssotkuzwfxtixgnbo`, región us-east-1)
- Instalado: 60 tablas, índices, relaciones, triggers de integridad (auditoría inalterable, doble autorización de inmovilización, cierres justificados), registro de migraciones de Prisma.
- Datos iniciales: 7 roles, 61 permisos, parámetros, umbrales de tiempos muertos, 3 turnos, regla de resguardo nocturno 22:00, matriz de escalamiento, 911 (sin verificar) y 9 usuarios iniciales.
- **Sin datos de demostración**: la base está lista para cargar información real.
- Seguridad: RLS activado en todas las tablas y acceso revocado a los roles públicos `anon` y `authenticated` de Supabase. La aplicación accede solo a través de su propio servidor; las llaves públicas de Supabase **no** dan acceso a los datos.

### Cadena de conexión
Supabase → proyecto → botón **Connect** → **Session pooler** (puerto 5432). Se ve así:
```
postgresql://postgres.rpsssotkuzwfxtixgnbo:[CONTRASEÑA]@aws-?-us-east-1.pooler.supabase.com:5432/postgres
```
Si no conoce la contraseña: *Project Settings → Database → Reset database password*. No la comparta por chat ni la suba a GitHub.

## 2. Aplicación — Render
Supabase aloja la base de datos, no el servidor web. La aplicación (pantallas + API + motor de reglas) se publica en Render:
1. Cree una cuenta en render.com con su usuario de GitHub.
2. **New → Blueprint** → elija el repositorio `MONITOREO-`. Render detecta `render.yaml`.
3. Cuando pida `DATABASE_URL`, pegue la cadena del *Session pooler* con su contraseña.
4. **Apply**. La primera publicación tarda 5–10 minutos.
5. Copie la URL que asigna Render (p. ej. `https://centro-inteligente-monitoreo.onrender.com`) y, si es distinta, actualice la variable `CORS_ORIGIN` con ella.

Costo aproximado en Render: servicio *Starter* (~7 USD/mes) + disco de 5 GB (~1.25 USD/mes) para documentos y fotografías.

## 3. Primer ingreso
Usuarios: `admin@cim.local`, `gerencia@cim.local`, `gerencia2@cim.local`, `oe@cim.local`, `supervisor@cim.local`, `monitorista1@cim.local`, `monitorista2@cim.local`, `ejecutor@cim.local`, `auditor@cim.local`.
Todos tienen la contraseña temporal entregada por separado y **deben cambiarla al primer ingreso**. Después, desde *Usuarios*, cree las cuentas reales del personal y desactive las que no use.
