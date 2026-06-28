# Guía técnica — Módulo de Logística (Reconecta VE)
### Estado del desarrollo y decisiones de arquitectura
### Para: Sergio · Última actualización: 28 jun 2026

> Esta guía documenta TODO lo construido del módulo de logística humanitaria: qué se hizo, por qué, y cómo encaja. Sirve para ponerse al día y para depurar si algo falla.

---

## 1. Resumen de lo construido hasta ahora

Tres capas terminadas:

1. **Base de datos en Supabase** — 13 tablas + roles + seguridad RLS + realtime.
2. **Paquete `@repo/logistics`** — lógica de dominio pura con 48 tests en verde.
3. **Cliente de Supabase en `apps/web`** — conexión navegador + servidor (en progreso).

---

## 2. Base de datos (Supabase) — COMPLETADO

Se ejecutaron 4 bloques SQL en orden. Todo está aplicado en producción.

### Bloque A — Tablas
Extensiones: `uuid-ossp`, `postgis` (para geo/cercanía).

Tablas creadas:
- `organization` — ONGs y organizaciones (con `org_type` para clasificar: salud, alimentación, refugios, etc.)
- `profile` — vincula `auth.users` con rol, org y centro. Campo `is_superadmin`.
- `collection_center` — centros de acopio (con `geo` auto-calculado por trigger desde lat/lng)
- `vehicle` — vehículos (identificados por placa o `device_id`)
- `shipment` — el "manifiesto digital": qué sale, de dónde, hacia dónde. `delivery_code` único.
- `shipment_item` — la carga de cada envío (con `category_other` para especificar "otros")
- `vehicle_ping` — rastros GPS (con `is_last_known` para la última posición antes de perder señal)
- `inventory_movement` — entradas/salidas de inventario de centros
- `supply_request` — solicitudes de insumos (qué falta, prioridad)
- `report_audit` — trazabilidad de cambios
- `donation_campaign` y `donation_allocation` — **INACTIVAS** (creadas pero apagadas, ver sección 6)

**Por qué `category_other`:** cuando alguien elige categoría "otros", este campo de texto guarda QUÉ es (pañales, linternas, etc.). Así no se pierde información y sigue siendo filtrable.

**Por qué triggers de `updated_at`:** para saber cuándo se modificó por última vez cada registro (necesario para el "actualizado hace X").

### Bloque A.5 — Roles e invitaciones
- **Trigger `handle_new_user`:** cada vez que alguien se registra en `auth.users`, se le crea automáticamente su fila en `profile` con rol `publico`. Sin esto, los perfiles no se crearían solos.
- **Tabla `invitation`:** códigos para asignar roles. Un superadmin/coordinador genera un código, la persona se registra y lo canjea con `redeem_invitation()`.
- **Funciones helper:** `current_role_app()`, `is_superadmin()`, `is_coordinator_or_ong()`, `current_center_id()`. Se usan en las políticas RLS.

**Jerarquía de roles (de mayor a menor poder):**
| Rol | Puede |
|---|---|
| superadmin (Gio + Sergio) | TODO, incluido crear coordinadores y otros superadmins |
| coordinador | Gestiona operación, ve todo el tracking, verifica ONGs. NO crea superadmins |
| ong | Ve todo el tracking, gestiona sus envíos/campañas |
| centro | Solo su centro: inventario, envíos que entran/salen |
| chofer | Solo su vehículo y sus envíos |
| receptor | Solo el envío hacia él (vía delivery_code) |
| publico | Centros y necesidades; NUNCA tracking en vivo |

**Por qué superadmin separado de coordinador:** un colaborador de confianza puede ser coordinador y ayudar a gestionar, pero no puede repartir poder (crear más coordinadores/superadmins). Eso queda solo en Gio y Sergio. Protege la plataforma.

**Los influencers NO tienen rol técnico** — su aporte es difusión, no gestión. Darles acceso a datos sensibles sería riesgo sin beneficio.

### Bloque B — Row Level Security (RLS) + Realtime
RLS activado en TODAS las tablas. Cada política define quién ve/edita qué.

**Lo más importante — seguridad del rol:** la política `profile_update` permite a cada quien editar su perfil PERO la promoción de rol va solo por `redeem_invitation` o por superadmin. **Nadie puede agarrar la URL + anon key y auto-promoverse a coordinador.** Esto es vital de cara a las donaciones.

**Tracking blindado (`vehicle_ping`):** solo coordinador/ONG/superadmin y el chofer dueño del vehículo. El público JAMÁS accede a ubicaciones en vivo.

**Realtime activado en:** `vehicle_ping`, `shipment`, `supply_request` — estas tablas emiten cambios por WebSocket automáticamente.

### Paso manual pendiente (hacer UNA vez)
Después de que Gio y Sergio se registren en la app:
```sql
update profile set role = 'coordinador', is_superadmin = true
where id in (
  select id from auth.users where email in ('gio@email.com', 'sergio@email.com')
);
```
Es el único paso manual de todo el sistema. De ahí en adelante, todo por invitación.

---

## 3. Paquete `@repo/logistics` — COMPLETADO (48 tests verde)

Lógica de dominio PURA (sin dependencias de DB), igual que `@repo/dedup`. Ubicación: `packages/logistics/src/`.

### Archivos
- **`types.ts`** — todos los tipos del dominio (espejo de las tablas, en camelCase).
- **`shipment.ts`** — máquina de estados de envíos. El corazón de la trazabilidad.
- **`tracking.ts`** — lógica de señal offline + visibilidad por rol.
- **`utils.ts`** — delivery codes, distancia geo, enmascarado de teléfonos.
- **`index.ts`** — punto de entrada (qué exporta el paquete).
- 3 archivos `.test.ts` — 48 tests.

### Máquina de estados de envíos (`shipment.ts`)
Estados: `preparando → en_ruta → entregado / incidencia`.

Transiciones válidas (cualquier otra se rechaza):
- `preparando` → `en_ruta` o `incidencia`
- `en_ruta` → `entregado` o `incidencia`
- `entregado` → (final, no se mueve)
- `incidencia` → `en_ruta` (se retoma)

**Funciones clave:**
- `dispatchShipment()` — despacha (no permite sin carga)
- `confirmDelivery()` — **EL CIERRE DEL BUCLE.** Confirma entrega solo con el `delivery_code` correcto + quién recibe. Esto mata la opacidad: un envío no se da por entregado hasta que el receptor lo confirma.
- `reportIncident()` / `resumeShipment()` — manejo de incidencias
- `movementsFromDelivery()` — genera automáticamente salida del origen + entrada al destino al confirmar
- `summarizeCategories()` — agrega por categoría (separa el "otros" por su especificación)

**Bug atrapado por los tests:** la normalización del `delivery_code` no manejaba el guion. Código guardado `K7P2-9XM4` vs ingresado `k7p2 9xm4` no coincidían. Se corrigió para ignorar espacios Y guiones. Sin los tests, esto habría rechazado entregas válidas en producción.

### Tracking (`tracking.ts`)
- `trackingStatus()` — determina si un vehículo está "en vivo" o muestra "última posición conocida hace X min". Umbral: 2 minutos sin ping sincronizado = sin señal.
- `prepareOfflineQueue()` — al reconectar, prepara los pings acumulados offline y marca el último como `is_last_known`.
- `detectGaps()` — detecta huecos de señal en un recorrido.
- `canViewLiveTracking()` — **la seguridad por rol en código.** Decide quién ve el tracking de cada vehículo/envío. Espejo de las políticas RLS.
- `buildPublicAggregates()` — para el público: "3 envíos de medicinas en ruta a La Guaira" SIN exponer ubicaciones exactas.

### Utilidades (`utils.ts`)
- `generateDeliveryCode()` — códigos tipo `K7P2-9XM4`, sin caracteres ambiguos (no O/0, I/1).
- `centerAcceptsCategory()` — valida si un centro puede recibir una categoría.
- `distanceKm()` — Haversine, para matching de solicitudes con centros cercanos.
- `maskPhone()` — enmascara teléfonos para vista pública (deja últimos 4 dígitos).

### Cómo correr los tests
```bash
npm test -w packages/logistics
# Esperado: 48 tests en verde (3 archivos)
```

---

## 4. Decisiones de arquitectura del TRACKING (importante)

### Intervalo de ping: 10-15 segundos + interpolación
- El teléfono captura y envía su posición cada 10-15s (no cada segundo: ahorra batería/datos/cuota).
- En el mapa, el marcador se **interpola** (anima suave entre punto A y B) para que se vea fluido aunque los datos lleguen cada 10-15s.

### Doble capa: Socket + REST (como en Anfalls)
Esta es la decisión clave de robustez. NO dependemos solo del socket.

- **Capa 1 — Socket (Supabase Realtime):** para ver el movimiento en vivo AHORA. Supabase ya provee los WebSockets (sobre Phoenix/Elixir), no los montamos a mano como en Anfalls. Reconexión automática.
- **Capa 2 — REST de respaldo:** al reconectar tras una caída, se piden por query REST todos los pings perdidos durante la desconexión y se rellenan. Esto lo programamos nosotros, igual que en Anfalls.

**Por qué la doble capa:** el socket se cae con mala señal (La Guaira) y durante la caída pierdes eventos. El REST rellena lo perdido. El socket es la cereza, el REST + captura local es la base.

### Tracking se activa al partir (tipo Uber)
El chofer toca "Iniciar ruta" → emite pings → al confirmar entrega → "Finalizar ruta" → deja de emitir. No rastrea todo el día.

### Límites de Supabase Realtime (free tier)
~200 conexiones concurrentes, ~2M mensajes/mes. Por eso el throttle de pings. Si el uso explota, hay que vigilar y eventualmente pagar tier.

---

## 5. Cliente de Supabase en `apps/web` — EN PROGRESO

Estructura (App Router, sin `src/`):
```
apps/web/lib/supabase/
├── client.ts      ← navegador (createBrowserClient, anon key)
├── server.ts      ← servidor (createServerClient, lee cookies)
└── queries/       ← (pendiente) shipments, centers, tracking
```

Usa `@supabase/ssr` (el recomendado para App Router), NO el viejo `@supabase/supabase-js` solo.

**OJO — posible duplicado:** Sergio creó un `supabase.ts`. Revisar si usa el patrón viejo (`createClient` de supabase-js) o el nuevo (`@supabase/ssr`). Unificar al nuevo para evitar dos clientes haciendo lo mismo.

---

## 6. Módulo de donaciones — DOCUMENTADO, INACTIVO

Las tablas existen (`donation_campaign`, `donation_allocation`) pero arrancan apagadas (`is_active = false`) y solo visibles para coordinador/ONG.

**Decisión legal crítica (sin resolver):** quién recibe el dinero.
- ❌ NO viable: recibir donaciones a nombre de un desarrollador (persona física). Riesgo fiscal, legal y de congelamiento bancario.
- ✅ Camino recomendado: beneficiario = ONG legalmente constituida. La plataforma es solo el puente tecnológico, nunca toca el dinero.

**Se activa cuando:** exista una ONG dispuesta a ser beneficiaria y publicar transparencia.

---

## 7. Próximos pasos

1. Revisar/unificar el `supabase.ts` de Sergio con `client.ts`/`server.ts`.
2. Queries de Supabase (`shipments.ts`, `centers.ts`, `tracking.ts`) — conectar `@repo/logistics` con las tablas.
3. Implementar la doble capa socket + REST en `tracking.ts`.
4. UI: registro de centros, creación de envíos, mapa con tracking.
5. Bot WhatsApp/Telegram para solicitudes de insumos.

---

## 8. Regla de oro (heredada del roadmap base)

> El software coordina e informa; no rescata, no entrega, no garantiza. Ninguna feature debe dar falsa confianza en escenarios de vida o muerte.

Esto aplica especialmente al tracking: NUNCA mostrar una posición vieja como si fuera actual. El indicador "en vivo" vs "hace X min" es obligatorio y explícito.