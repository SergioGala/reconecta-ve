# Roadmap — Módulo de Logística Humanitaria
### Reconecta VE · Coordinación de insumos, transporte y centros de acopio
### Terremotos de Venezuela, junio 2026

> **Tesis del módulo:** operar como una empresa de logística, pero al servicio de la emergencia. Trazabilidad de punta a punta: *qué salió → por dónde va → dónde se entregó → quién lo recibió*. El valor no es "otro mapa", es **cerrar el bucle** y eliminar la opacidad actual en la distribución de donaciones.

---

## 0. Alcance de este documento

Este roadmap cubre **tres capas** del sistema, todas en estado prioritario (🔴):

1. **Tracking de vehículos en tiempo real** (con degradación offline)
2. **Gestión de suministros** (qué sale, hacia dónde, qué se necesita)
3. **Centros de acopio verificados** (recolección, despacho, recepción)

El **módulo de donaciones** queda documentado por separado en estado 🟢 (en pausa, pendiente de definición legal). Ver sección 7.

---

## 1. Principios de diseño (heredados del roadmap base)

Todo lo que se construya respeta los gates ya establecidos:

- **Offline-first real:** registrar y consultar sin conexión; sincronización diferida con Background Sync. Probado con la red apagada.
- **Bajo consumo:** sin polling agresivo, payloads mínimos, modo de datos reducidos. Pensado para Android gama baja en 3G lento.
- **Privacidad por defecto:** datos sensibles enmascarados en vista pública; RLS en Supabase.
- **i18n:** español primero.
- **Confianza como activo:** trazabilidad auditable, responsables identificables.
- **Regla de oro:** el software coordina e informa; no rescata, no entrega, no garantiza. Ninguna feature debe dar falsa confianza.

---

## 2. Stack (alineado al monorepo existente)

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript, PWA | ya en el repo |
| Mapas | MapLibre GL + OpenStreetMap | gratis, sin Google Maps |
| Tiempo real | Supabase Realtime (canales) | tracking + estados de envío |
| Geo | PostGIS (Supabase) | consultas por cercanía |
| Estado offline | IndexedDB (Dexie) + Service Worker (Workbox) + Background Sync | cola de eventos pendientes |
| Backend/DB | Supabase (Postgres + RLS) | free tier |
| Nuevo paquete | `packages/logistics` | tipos + lógica de dominio compartida |

**Nuevo en el monorepo:** `packages/logistics` (modelos, máquina de estados de envíos, utilidades geo) consumido por `apps/web` y `apps/bot`.

---

## 3. Modelo de datos

```
vehicle
  id (uuid)
  plate                      -- placa vehicular (identificador humano)
  device_id                  -- id del dispositivo que emite (fallback si no hay placa)
  type: camion | camioneta | moto | particular
  driver_name
  driver_contact_masked / driver_contact_encrypted
  status: disponible | en_ruta | descargando | inactivo
  org_id (fk -> organization, opcional)

shipment                     -- el "manifiesto digital"
  id (uuid)
  vehicle_id (fk)
  origin_center_id (fk -> collection_center)
  destination_center_id (fk, nullable)   -- puede ser un refugio o zona
  destination_label          -- texto libre si no es un centro registrado
  status: preparando | en_ruta | entregado | incidencia
  departed_at, delivered_at
  created_by, confirmed_by   -- trazabilidad
  delivery_code              -- código corto que el receptor confirma

shipment_item                -- qué lleva cada envío
  id (uuid)
  shipment_id (fk)
  category: alimentos | medicinas | agua | higiene | ropa | otros
  description
  quantity, unit             -- ej. 50 cajas, 200 litros
  notes

vehicle_ping                 -- rastros de ubicación
  id (uuid)
  vehicle_id (fk)
  lat, lng
  recorded_at                -- cuándo lo capturó el teléfono (no cuándo llegó)
  synced_at                  -- cuándo se sincronizó (para detectar gaps)
  is_last_known: bool        -- marca la última posición antes de perder señal

collection_center            -- centro de acopio
  id (uuid)
  name
  type: alimentos | medicinas | mixto | agua | higiene
  lat, lng, address
  manager_name, manager_contact_masked
  status: activo | lleno | cerrado
  verified: bool             -- verificación ligera (responsable identificable)
  last_updated_at

inventory_movement           -- entradas/salidas del centro
  id (uuid)
  center_id (fk)
  direction: entrada | salida
  category, description, quantity, unit
  related_shipment_id (fk, nullable)
  recorded_by, recorded_at

supply_request               -- qué falta / qué se necesita
  id (uuid)
  center_id (fk, nullable)   -- o zona/refugio
  zone_label
  category, description, quantity_needed, unit
  priority: critica | alta | media
  status: abierta | parcial | cubierta
  created_at, fulfilled_at

report_audit                 -- trazabilidad transversal (heredado)
  who, what, when, before, after
```

**Vistas públicas:** siempre desde columnas enmascaradas. Contactos de chofer y responsable nunca salen por la API pública. Coordenadas de refugios sensibles se aproximan.

---

## 4. Roadmap por sprints

### 🔴 Sprint L1 — Manifiesto digital + centros de acopio (días 1–4)
**Meta:** registrar qué sale, de dónde, hacia dónde, y qué tienen los centros. Es la base de todo.

- [ ] `packages/logistics`: tipos del modelo + máquina de estados de `shipment` (preparando → en_ruta → entregado / incidencia) con tests.
- [ ] CRUD de `collection_center` con verificación ligera (responsable con nombre + contacto + foto del lugar).
- [ ] CRUD de `shipment` + `shipment_item` (el manifiesto: categorías, cantidades).
- [ ] Generación de `delivery_code` corto por envío.
- [ ] Vista de lista de centros con su tipo (alimentos / medicinas / mixto) y estado.
- [ ] Offline-first: registrar envío y centro sin conexión → cola Dexie → sync.
- **DoD:** un coordinador registra un centro, crea un envío con su carga, y todo persiste offline y sincroniza al reconectar.

### 🔴 Sprint L2 — Cierre del bucle: recepción confirmada (días 5–8)
**Meta:** el envío no se da por entregado hasta que alguien lo confirma. Esto mata la opacidad.

- [ ] Flujo de recepción: el receptor introduce el `delivery_code` → marca `entregado` + `confirmed_by`.
- [ ] Registro de `inventory_movement` automático al confirmar (salida del origen, entrada al destino).
- [ ] Estado `incidencia` con motivo (no llegó completo, dañado, desviado).
- [ ] Timeline visual por envío: *salió de X (hora) → en ruta → recibido por Y (hora)*.
- [ ] `report_audit` registrando cada cambio de estado y quién lo hizo.
- **DoD:** un envío completo es trazable de punta a punta; un tercero puede ver que salió, llegó y quién lo recibió.

### 🔴 Sprint L3 — Tracking en tiempo real (días 9–13)
**Meta:** ver dónde van los vehículos, con degradación honesta cuando no hay señal.

- [ ] PWA del chofer: emite `vehicle_ping` cada 30–60s vía Supabase Realtime cuando hay señal.
- [ ] Captura local continua de pings en IndexedDB (graba aunque no haya señal).
- [ ] Al reconectar: sube el lote de pings acumulados (recorrido completo), marca `is_last_known` en el último antes del gap.
- [ ] Mapa MapLibre con vehículos en vivo + última posición conocida (con sello de hora: "visto hace X min").
- [ ] Asociación vehículo ↔ envío activo (clic en el camión muestra su manifiesto).
- [ ] Indicador claro de estado de señal: "en vivo" vs "última posición hace X".
- **DoD:** un coordinador ve los camiones moverse; cuando uno pierde señal, ve su última posición con sello de hora; al reconectar, el recorrido se completa.

### 🔴 Sprint L4 — Solicitudes de suministros + matching (días 14–18)
**Meta:** que las necesidades sean visibles y se conecten con quien puede cubrirlas.

- [ ] CRUD de `supply_request` con prioridad (crítica / alta / media) y categoría.
- [ ] Tablero de necesidades filtrable por zona y categoría (Supabase Realtime).
- [ ] Matching: un centro/voluntario con excedente ve solicitudes cercanas (PostGIS).
- [ ] Estados: abierta → parcial → cubierta, con expiración.
- [ ] Entrada por bot de WhatsApp/Telegram: reportar necesidad por chat (reusa infra del roadmap base).
- **DoD:** un refugio publica "necesito X" por WhatsApp y aparece en el tablero; un centro cercano lo ve y lo marca "en camino".

### 🟡 Sprint L5 — Tablero de coordinación + datos abiertos (días 19–24)
- [ ] Panel de coordinador: vista unificada de vehículos, envíos activos, centros y necesidades.
- [ ] Cifras agregadas verificadas (cuánto salió, cuánto se entregó, % cubierto) exportables para prensa/ONG.
- [ ] Alertas: envíos detenidos demasiado tiempo, necesidades críticas sin cubrir.
- **DoD:** una ONG ve el estado global de la operación y exporta cifras agregadas confiables.

---

## 4.5 Visibilidad del tracking por rol (decisión de seguridad)

El tracking en vivo NO es público. En contexto de escasez, exponer un camión cargado con su ubicación en vivo lo convierte en blanco de robo y pone en riesgo al chofer. La visibilidad se controla por rol mediante RLS en Supabase (a nivel de base de datos, no solo frontend).

| Rol | Qué ve del tracking |
|---|---|
| Coordinador / ONG verificada | Todo: vehículos en vivo, rutas, manifiestos completos |
| Chofer | Su propio recorrido y su envío asignado |
| Centro de acopio | Envíos que salen de o llegan a su centro |
| Receptor del envío | Solo el envío específico hacia él (vía `delivery_code`) |
| Público / usuario común | Agregados, NO ubicaciones en vivo (ej: "3 envíos de medicinas en ruta a La Guaira hoy") |

La transparencia se logra con el cierre del bucle (envíos confirmados, cifras agregadas), no exponiendo GPS en vivo a desconocidos.

---

## 5. Tracking offline — cómo funciona realmente (sin promesas falsas)

**Lo que SÍ funciona sin señal:**
- Registrar carga, escanear/confirmar entrega, consultar lo ya descargado, grabar el recorrido GPS localmente.

**Lo que NO puede funcionar sin señal (límite físico):**
- Transmisión en vivo de la ubicación. Sin red, el teléfono no puede enviar nada en ese instante.

**La solución honesta:**
- El teléfono **graba los pings localmente** aunque no haya señal.
- Se muestra la **última posición conocida** con sello de hora ("visto hace 8 min").
- Al recuperar señal (aunque sea intermitente), sube todo el recorrido acumulado de golpe y vuelve a "en vivo".
- Nunca se presenta una posición vieja como si fuera actual. El indicador de señal es explícito.

Para huecos totales de cobertura prolongados, el tracking satelital (hardware tipo Garmin inReach) sería la única alternativa de transmisión en vivo real — caro y fuera del alcance del MVP. No se incluye.

---

## 6. Calidad e ingeniería (gates por PR)

- **Tests:** Vitest en `packages/logistics` (máquina de estados de envíos, utilidades geo). Playwright e2e para el flujo registrar→despachar→recibir offline.
- **Cobertura mínima:** 80% en la lógica de dominio de `logistics`.
- **CI:** typecheck + lint + tests + build + Lighthouse en cada PR.
- **Performance:** FCP < 1.5s en 3G lento; bundle inicial mínimo.
- **Revisión:** cambios que exponen datos sensibles (contactos, ubicaciones de refugios) requieren 2 reviewers.

---

## 7. 🟢 Módulo de donaciones (EN PAUSA — pendiente de definición legal)

> Este módulo NO se desarrolla hasta resolver la estructura legal de recepción de fondos. Se documentan aquí los puntos a tomar para cuando se active.

**Decisión crítica sin resolver:** quién recibe el dinero.

- ❌ **No viable:** recibir donaciones a nombre de un desarrollador (persona física). Riesgo fiscal, legal y de congelamiento bancario. El dinero entrante a una cuenta personal se trata como renta propia y dispara bloqueos en transferencias internacionales.
- ✅ **Camino recomendado:** el beneficiario es una **ONG o asociación legalmente constituida**. La plataforma es solo el puente tecnológico — nunca toca el dinero.

**Funcionalidades a incluir cuando se active (puntos a tomar):**
- Integración con pasarela (Stripe/GoFundMe) con beneficiario = ONG verificada, no individuo.
- Transparencia en tiempo real: la ONG publica en qué se gastó cada tramo.
- Cierre del bucle donación → compra → llegó al refugio X → recibido por Y (reusa la trazabilidad de Sprint L2).
- Verificador anti-estafa de campañas (semáforo verificada / no verificada). Lenguaje legal prudente.
- Descubrimiento de organizaciones verificadas para evitar fraudes.

**Rol de las partes (triangulación realista):**
- **Tecnología (ustedes, los 2 devs):** construyen la capa de coordinación y trazabilidad. Un vértice.
- **Dinero (ONG constituida):** recibe y administra fondos con su estructura legal.
- **Operación (administrador en Venezuela + voluntarios + ONG):** compras, refugios, logística física.

**Umbral de decisión para activar:** existe una ONG dispuesta a ser beneficiaria y a publicar transparencia. Sin eso, el módulo permanece en 🟢.

---

## 8. Riesgos y umbrales de decisión

- **Tracking en vivo sobrevende capacidad** → siempre mostrar estado de señal explícito; nunca presentar posición vieja como actual.
- **Verificación de centros da falsa confianza** → la verificación es ligera (responsable identificable), no una garantía. Comunicarlo claro.
- **Carga sobre free tier** (muchos pings) → throttle de pings, agregación, caché agresivo. Asumir costo bajo puntual si hace falta.
- **Dos developers, alcance grande** → priorizar L1–L2 (trazabilidad) que es el diferenciador. El resto es incremental.
- **Datos sensibles de víctimas/refugios** → RLS estricto, enmascarado, coordenadas aproximadas en puntos sensibles.

---

## 9. Reparto sugerido (2 developers)

- **Dev A:** `packages/logistics` (modelos + máquina de estados) + backend Supabase + RLS + cierre de bucle (L1, L2).
- **Dev B:** PWA + mapa MapLibre + tracking + offline/Dexie/Background Sync (L3) + tablero (L5).
- **Compartido:** bot WhatsApp/Telegram para solicitudes (L4).

---

## 10. Métricas de éxito (no de vanidad)

- % de envíos con cierre de bucle completo (salió → recibido confirmado).
- Tiempo medio entre solicitud de insumo y "en camino".
- Necesidades críticas cubiertas / totales.
- Nº de centros de acopio activos con inventario actualizado en las últimas 24h.
- Reducción de envíos "perdidos" (sin confirmación de recepción).

> **Recordatorio:** esto se construye para ayudar a la mayor cantidad de personas posible. La tecnología coordina y da transparencia. Las vidas las salvan las personas en el terreno.
