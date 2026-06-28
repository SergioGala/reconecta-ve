# 📋 Estado del proyecto — Reconecta VE
### Documento de situación · módulo base + logística (lectura)
_Última actualización: hasta el cierre de la lectura de centros de acopio. **No** incluye aún el formulario de registro (escritura), que es el siguiente paso pendiente._

---

## 1. Qué es y tesis

**Reconecta VE** es una plataforma de coordinación ciudadana para la emergencia de los terremotos de Venezuela (junio 2026). Repo: `github.com/SergioGala/reconecta-ve` · Producción: `reconecta-ve.vercel.app`.

**Tesis:** no construir "otro mapa", sino la capa que falta — consolidación de personas (meta-buscador deduplicado) y **logística humanitaria con trazabilidad de punta a punta** (qué salió → por dónde va → quién lo recibió). El valor está en cerrar el bucle y en interoperar, no en duplicar lo que ya existe.

Actualmente el desarrollo activo está en el **módulo de logística**.

---

## 2. Stack y arquitectura (decisiones cerradas)

| Capa | Decisión | Nota |
|---|---|---|
| Monorepo | **Turborepo + npm** | se intentó pnpm; falló en Windows, se migró a npm (ver §6) |
| Frontend | **Next.js 16 (App Router) + TypeScript, PWA** | |
| PWA | **Serwist** (`@serwist/next`) | `next-pwa` está abandonado |
| Build | **webpack** (`next build --webpack`) | Serwist aún no soporta Turbopack en Next 16 |
| Backend/DB | **Supabase** (Postgres + PostGIS + RLS) | free tier |
| Hosting | **Vercel** (frontend) | deploy automático al hacer push a `main` |
| Mapas (pendiente) | MapLibre + OpenStreetMap | aún no integrado (Sprint L3) |

**Estructura del repo:**
```
reconecta-ve/
├── apps/
│   └── web/                    app Next.js (PWA)
│       ├── app/
│       │   ├── page.tsx        home: "prueba de base de datos" (Fase 0)
│       │   ├── centros/
│       │   │   ├── page.tsx    lista de centros de acopio ✅
│       │   │   └── centros.module.css
│       │   ├── layout.tsx
│       │   ├── sw.ts           service worker (Serwist)
│       │   └── manifest.ts
│       ├── lib/supabase.ts     cliente público de Supabase
│       ├── next.config.js      Serwist + transpilePackages
│       └── tsconfig.json       propio (no hereda del compartido) ⚠️ ver §6
├── packages/
│   ├── logistics/              dominio de logística (del compañero) + index.ts ✅
│   ├── ui / eslint-config / typescript-config
│   └── (NO existe dedup) ⚠️ ver §8
├── .github/workflows/ci.yml    CI: install + lint + build
└── turbo.json
```

---

## 3. Lo que está HECHO y funciona

### Fase 0 — Fundaciones ✅ (completa)
- Monorepo Turborepo + npm, arrancando en local.
- Repo en GitHub con **CI en verde** (instala, lint, build).
- **Desplegado en Vercel** con URL pública funcional.
- **PWA con Serwist**: instalable y **offline-first probado** (la app abre sin conexión y muestra indicador "Sin conexión · datos en caché").

### Base de datos — Personas ✅
Tablas creadas con RLS: `sources`, `person_record`, `note_record`, y `person_contact` (sensible, sin lectura pública). La home (`/`) lee personas reales desde Supabase como prueba de conexión.

### Base de datos — Logística ✅
Las tablas de logística las creó el compañero (más completas que el plan inicial). **RLS verificado: activado en las 13 tablas.** Datos de ejemplo cargados: 2 organizaciones, 2 centros de acopio, 2 solicitudes de insumos.

### Paquete `@repo/logistics` ✅ (reparado y conectado)
- El compañero programó la lógica de dominio: `shipment.ts` (máquina de estados de envíos, con cierre de bucle por `delivery_code`), `tracking.ts` (estado de señal, cola offline, agregados públicos, control por roles), `utils.ts` (`generateDeliveryCode`, `maskPhone`, `distanceKm`, etc.), `types.ts`, todo con tests.
- **Faltaba el `index.ts`** (su `package.json` apuntaba a un archivo inexistente) → se creó. Ahora el paquete se importa correctamente.
- Se conectó a `apps/web`: declarado como dependencia + `transpilePackages: ["@repo/logistics"]` en `next.config.js`.

### Pantalla de centros de acopio ✅ (`/centros`)
Lee `collection_center` de Supabase (lectura pública), mapea snake_case→camelCase a los tipos del paquete, y muestra tarjetas con tipo, estado, responsable y contacto **enmascarado**. Funciona en local y en producción.

---

## 4. Estado real de la base de datos (columnas confirmadas)

> Importante: estas son las columnas **reales** que creó el compañero, no las del plan original. Difieren en varios puntos (ver §8). Confirmadas vía `information_schema`.

**`collection_center`:** id, name, type, lat, lng, **geo** (PostGIS), address, manager_name, manager_contact_masked, **manager_contact_encrypted**, status, verified, org_id, created_at, **updated_at**.

**`organization`:** id, name, is_verified, contact_masked, org_type, created_at, updated_at.

**`shipment`:** id, vehicle_id, origin_center_id, destination_center_id, destination_label, status, departed_at, delivered_at, created_by (uuid), confirmed_by (text), delivery_code, created_at, updated_at.

**`shipment_item`:** id, shipment_id, category, category_other, (description, quantity, unit, notes).

**`inventory_movement`:** id, center_id, direction, category, category_other, description, quantity, unit, related_shipment_id, recorded_by (uuid), recorded_at.

**`report_audit`:** id, who (uuid), what (text), **entity_type**, **entity_id**, **before_state**, **after_state**, created_at.

**`profile`:** id, full_name, role, org_id, center_id, phone_masked, is_superadmin, created_at, updated_at.

**`donation_campaign` / `donation_allocation`:** existen (módulo en pausa, ver §8).

**`invitation`:** id, code, role, grants_superadmin, org_id, center_id, created_by, expires_at, used_by, used_at, is_active, created_at.

⚠️ **Pendiente de confirmar:** las columnas de `vehicle`, `vehicle_ping` y `supply_request` no se capturaron en el volcado (quedó truncado). Verificar antes de usarlas.

---

## 5. Variables de entorno (qué va dónde)

| Variable | Dónde | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel + secretos CI | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel + secretos CI | clave **pública** (`sb_publishable_`), segura para el navegador gracias al RLS |
| `SUPABASE_SECRET_KEY` | **(pendiente)** | clave **secreta** (`sb_secret_`), solo servidor — se usará en el formulario de registro |

Regla: lo que lleva `NEXT_PUBLIC_` puede ir al navegador; lo que no, se queda en el servidor. La clave secreta **nunca** va a GitHub ni al navegador.

---

## 6. Decisiones y trampas resueltas (memoria del proyecto)

Esto le ahorra a cualquiera repetir las mismas peleas:

- **pnpm → npm.** El instalador de pnpm falló en Windows (carpeta protegida + ejecutable que no se colocó). Se migró todo a **npm**. En este monorepo: instalar siempre **desde la raíz** con `npm install <paquete> -w apps/web`; nunca dentro de la subcarpeta (da `Cannot read properties of null`).
- **tsconfig propio en `web`.** El `extends` al `@repo/typescript-config` no resolvía (Windows + Turbopack). Se le dio a `web` un `tsconfig.json` **completo y propio**. Mismo patrón en `packages/logistics`. Es pragmático, no "cutre": es la config estándar de Next.
- **`docs` borrada.** La app de ejemplo de Turborepo rompía los builds; se eliminó.
- **Serwist + Next 16.** Serwist no soporta Turbopack todavía → los scripts usan `next dev --webpack` y `next build --webpack`.
- **Lint de la CI.** ESLint se quejaba del `sw.js` generado por Serwist → se añadió a `ignores`.
- **Build de la CI / Vercel.** Fallaba con `supabaseUrl is required` porque faltaban las claves. Se añadieron como **secretos** en GitHub Actions y como **Environment Variables** en Vercel.
- **Deploy de Vercel servía la plantilla por defecto.** Causa: Root Directory mal apuntado y/o faltaban las env. Se fijó **Root Directory = `apps/web`** + claves + Redeploy.
- **snake_case ↔ camelCase.** La DB usa snake_case y los tipos camelCase; cada pantalla mapea entre ambos. (Ej.: la lista de centros falló por pedir `last_updated_at` cuando la columna real es `updated_at`.)

---

## 7. Seguridad (estado actual)

- **RLS activado en todas las tablas** (verificado).
- Lectura pública solo donde tiene sentido: `collection_center`, `organization`, `supply_request`. Lo operativo/sensible (envíos, vehículos, tracking, inventario, auditoría, donaciones) **no es público**.
- **Contactos enmascarados** en las columnas `_masked`; los teléfonos crudos no se exponen.
- La clave que se salta el RLS (`sb_secret_`) aún no está en uso; cuando se use, irá solo en servidor.

⚠️ Matiz honesto: "RLS activado con políticas" no garantiza que las políticas digan lo correcto (lectura pública vs. solo-dueño). El control fino **por roles** (coordinador ve todo, receptor solo lo suyo) está documentado en el roadmap pero **aún no implementado**.

---

## 8. Deuda técnica y avisos (importante para el equipo)

1. **Desajuste tipos ↔ tablas en `report_audit`.** Los tipos del paquete dicen `who/what/when/before/after`; la tabla real tiene `who/what/entity_type/entity_id/before_state/after_state/created_at`. **No coinciden.** El cierre del bucle (Sprint L2) escribe auditoría → hay que **reconciliar esto antes del L2**.
2. **Posibles desajustes similares en otras tablas.** Conviene una sesión de reconciliación tipos↔tablas para no ir tropezando pantalla por pantalla.
3. **El paquete `dedup` (buscador de personas) nunca se construyó.** Era la Fase 1 original (meta-buscador deduplicado, el otro gran diferenciador). Se entregó listo (algoritmo Jaro-Winkler + 13 tests) pero **no se aplicó al repo**: el proyecto pivotó a logística. Sigue disponible para retomar.
4. **Módulo de donaciones en pausa.** Las tablas `donation_campaign` y `donation_allocation` existen, pero el roadmap es explícito: **no se activa** hasta resolver la estructura legal (el beneficiario debe ser una ONG constituida, nunca un individuo). Que las tablas existan no cambia eso.
5. **Columnas de `vehicle` / `vehicle_ping` / `supply_request` sin verificar** (volcado truncado).
6. **Políticas RLS por rol sin implementar** (ver §7).

---

## 9. Dónde estamos en el roadmap y qué sigue

**Sprint L1 (logística base):**
- ✅ Tablas + RLS + datos de ejemplo.
- ✅ Paquete conectado.
- ✅ Lectura: pantalla de centros de acopio.
- ⏳ **Escritura: formulario de registro de centros** — diseñado pero **aún no aplicado** (es el siguiente paso inmediato). Implica usar la clave secreta vía Server Action.

**Sprint L2 (el diferenciador):** alta de envíos + cierre del bucle (confirmación con `delivery_code`, timeline "salió → en ruta → recibido"). ⚠️ Bloqueado por el desajuste de `report_audit` (§8.1).

**Después:** L3 tracking en tiempo real (mapa MapLibre), L4 solicitudes + matching, L5 tablero y datos abiertos.

---

## 10. Cómo arrancar el proyecto (recordatorio)

```powershell
# desde la raíz del repo
npm install
npm run dev          # arranca la web en http://localhost:3000

# rutas útiles:
#   /          home de prueba (personas)
#   /centros   lista de centros de acopio

# para probar la PWA (modo producción):
npm run build
npm start -w web
```

> Recordatorio: todos los `npm install` se hacen desde la raíz (con `-w apps/web` para instalar en la app). Nunca dentro de la subcarpeta.
