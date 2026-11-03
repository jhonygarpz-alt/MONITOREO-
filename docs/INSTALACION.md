# Instalación, configuración y despliegue

## Requisitos
- Node.js 22 LTS y npm 10
- PostgreSQL 16 (14+ funciona)
- Para producción: proxy HTTPS (Nginx, Caddy o balanceador del proveedor de nube)

## 1. Base de datos
```sql
CREATE USER cim WITH PASSWORD 'una-contraseña-robusta';
CREATE DATABASE cim OWNER cim;
```
En desarrollo, el usuario necesita `CREATEDB` para que `prisma migrate dev` cree la base sombra.

## 2. Instalación local
```bash
npm run install:all
cp apps/api/.env.example apps/api/.env
npm run db:migrate --prefix apps/api
npm run db:seed --prefix apps/api             # sin datos de demostración
# o: SEED_DEMO=true npm run db:seed --prefix apps/api
npm run dev:api
npm run dev:web
```
El frontend (5173) redirige `/api` a la API (4000).

## 3. Variables de entorno (`apps/api/.env`)
| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | Sí | Secreto de firma de sesiones, ≥32 caracteres aleatorios (`openssl rand -hex 32`) |
| `JWT_EXPIRES_HOURS` | No (12) | Duración de la sesión |
| `CORS_ORIGIN` | No | Orígenes permitidos, separados por coma |
| `COOKIE_SECURE` | Producción: `true` | Cookie solo por HTTPS |
| `STORAGE_DIR` | No (`./storage`) | Carpeta privada de documentos y fotografías (respaldar) |
| `MAX_UPLOAD_MB` | No (15) | Tamaño máximo de archivo |
| `RUN_SCHEDULER` | No (`true`) | Ejecutar el motor de reglas dentro de la API; en producción use `false` y el proceso worker |
| `SCHEDULER_TICK_SECONDS` | No (60) | Frecuencia del motor de reglas |
| `BCRYPT_ROUNDS` | No (12) | Costo del hash de contraseñas |
| `LOG_LEVEL` | No (`info`) | Nivel de registro (pino, JSON) |
| `SEED_PASSWORD` | Solo semilla | Contraseña inicial de los usuarios sembrados; en producción se fuerza el cambio al primer inicio |
| `SEED_DEMO` | Solo semilla | `true` carga datos de demostración etiquetados `[DEMO]` |

Variables del frontend (opcional, en desarrollo): `VITE_API_PROXY` para cambiar el destino del proxy.

## 4. Pruebas
```bash
createdb -O cim cim_test          # una vez
npm test                          # reinicia cim_test, aplica migraciones y ejecuta 26 escenarios
```
Use `TEST_DATABASE_URL` para otra base de pruebas. **Nunca** apunte las pruebas a la base productiva: se reinicia.

## 5. Despliegue en producción con Docker
```bash
cat > .env <<'X'
POSTGRES_PASSWORD=...
JWT_SECRET=...
PUBLIC_URL=https://monitoreo.suempresa.mx
COOKIE_SECURE=true
X
docker compose up -d --build
docker compose exec api npx tsx prisma/seed.ts      # primera vez
```
- `api` aplica migraciones al arrancar (`prisma migrate deploy`), sirve la API y el frontend compilado en el mismo origen.
- `worker` ejecuta el motor de reglas de forma independiente del navegador; puede haber varias réplicas sin duplicar eventos.
- Coloque un proxy HTTPS delante del puerto 4000 (HSTS ya lo envía la API).

### Despliegue sin Docker
```bash
npm run build
cd apps/api && NODE_ENV=production npx prisma migrate deploy
NODE_ENV=production RUN_SCHEDULER=false node dist/server.js     # servicio 1 (systemd/pm2)
NODE_ENV=production node dist/worker.js                         # servicio 2
```

## 6. Operación y respaldo
- Respaldo diario de PostgreSQL (`pg_dump -Fc`) y de `STORAGE_DIR`; pruebe la restauración.
- Antes de operar con información real: `npm run db:purge-demo --prefix apps/api`, elimine catálogos `[DEMO]`, cambie contraseñas iniciales, cargue y verifique el directorio de emergencias, puntos de resguardo y zonas de riesgo.
- Supervise `GET /api/health` y la pestaña *Configuración → Automatizaciones* (job_runs fallidos).
- Para verificar la integridad de la bitácora: *Auditoría → Verificar integridad* (`GET /api/admin/audit/verify`).
- Recomendado a nivel BD: que el usuario de la aplicación no sea propietario de las tablas de auditoría en producción (revocar `TRIGGER`/`ALTER` para que nadie pueda desactivar los triggers).
