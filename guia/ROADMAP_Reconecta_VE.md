# Roadmap de ejecución — "Reconecta VE"
### Plataforma de consolidación e intercambio para la emergencia (terremotos de Venezuela, jun. 2026)

> **Tesis del producto:** no construimos "otro mapa". Construimos **la capa que une a todas las plataformas**: un meta-buscador deduplicado de personas (estándar abierto PFIF) + logística hiperlocal de insumos/refugios. Diferenciación = interoperabilidad + cierre del bucle, no otra copia.

---

## 0. Quality bar (no negociable)

Cada PR se mide contra esto. Si no cumple, no entra a `main`.

- **Rendimiento:** First Contentful Paint < 1.5 s en 3G lento / Android gama baja. Bundle JS inicial < 120 KB gzip. Lighthouse ≥ 95 en Performance/Accessibility/Best Practices.
- **Offline-first real:** la app abre y permite buscar/reportar sin conexión; los reportes se encolan y sincronizan al volver la señal (Background Sync). Probado con la red apagada, no simulado.
- **Accesibilidad:** WCAG 2.1 AA. Navegable por teclado, foco visible, contraste ≥ 4.5:1, `prefers-reduced-motion` respetado, lectores de pantalla en español.
- **Bajo consumo:** sin fuentes externas pesadas (system stack), imágenes diferidas y comprimidas, sin polling agresivo, payloads mínimos. Modo de datos reducidos.
- **Privacidad por defecto:** datos sensibles (cédula, teléfono, dirección exacta) enmascarados en vista pública; expiración/borrado por registro; nada de tracking de terceros ni ads.
- **i18n:** español primero, inglés para la diáspora, desde el día 1.
- **Confianza:** equipo identificable, política de privacidad clara, código abierto. La confianza es el activo principal del proyecto.

---

## 1. Decisiones de arquitectura (cerradas)

| Capa | Decisión | Por qué |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript, como PWA** | SSR/ISR para SEO y velocidad; PWA evita fricción de tiendas |
| Estilos | **Tailwind + tokens propios** (sin librería de componentes pesada) | control de diseño y peso mínimo |
| Estado offline | **IndexedDB (Dexie) + Service Worker (Workbox) + Background Sync** | escritura sin conexión y sync diferido |
| Backend/DB | **Supabase** (Postgres + PostGIS + Realtime), free tier | geo + tiempo real + auth; escalable |
| Mapas | **MapLibre GL / Leaflet + OpenStreetMap** | gratis; nunca Google Maps de pago |
| Ingreso de datos | **Bot de WhatsApp + Telegram**; fallback **SMS/USSD** | la gente ya vive en WhatsApp; USSD para zonas sin datos |
| Interoperabilidad | **PFIF 1.3** (People Finder Interchange Format) como formato de intercambio | estándar abierto; permite consolidar y exportar a otras plataformas |
| Hosting | **Vercel** (frontend) + Supabase; **Cloudflare** delante para picos | free tier + CDN agresivo |
| Dedup | bloqueo + similitud (Jaro-Winkler / token-sort) con merge **reversible** | nunca fusionar sin poder deshacer |

**Monorepo** (`pnpm` + Turborepo): `apps/web`, `apps/bot`, `packages/pfif`, `packages/dedup`, `packages/ui`, `packages/db`.

---

## 2. Modelo de datos (alineado a PFIF)

```
person_record
  id (uuid)                       source_record_id (dominio:id, PFIF)
  full_name, given_name, family_name
  age, sex
  home_zone, last_seen_zone, last_seen_at
  status: missing | alive | found | deceased
  photo_url (opcional)
  contact_masked (vista pública)  contact_encrypted (privado)
  expiry_date                     entry_date, source_date, author_name
note_record (PFIF note)
  linked_person_record_id (merge reversible)
  status, text, author, posted_at
source             (catálogo de fuentes: nombre, url, confianza)
help_request / help_offer / shelter / collection_center / machinery / volunteer
report_audit       (trazabilidad: quién cambió qué y cuándo)
```

Las vistas públicas se sirven siempre desde columnas enmascaradas. RLS (Row Level Security) en Supabase para que lo sensible nunca salga por la API pública.

---

## 3. Roadmap por fases (sprints cortos)

### 🔴 Sprint 1 — "Buscar una vez, encontrar en todas" (días 1–4)
**Meta:** MVP del meta-buscador deduplicado en producción.
- [ ] `packages/pfif`: tipos + parser/serializer PFIF 1.3 con tests.
- [ ] `packages/dedup`: normalización (acentos, tokens), similitud Jaro-Winkler + match por cédula, clustering con merge reversible; **suite de tests con casos reales de nombres venezolanos**.
- [ ] Ingesta v0: importadores de las 3–4 bases mayores (desaparecidosterremotovenezuela, venezuelatebusca, Hazlo Hoy) → normaliza a PFIF → Supabase.
- [ ] UI de búsqueda unificada (nombre / cédula / zona) + tarjeta de resultado con "Consolidado de N fuentes".
- [ ] "Marcar como encontrado" (la buena noticia gana) + enlace privado.
- [ ] PWA shell + caché offline de lecturas.
- **DoD:** una familia busca una vez y ve registros cruzados de varias fuentes deduplicados; instalable; pasa Lighthouse ≥ 95.

### 🔴 Sprint 2 — Ingreso sin fricción + endpoint abierto (días 5–8)
- [ ] **Bot de WhatsApp/Telegram** para reportar desaparecido / marcar a salvo / pedir insumo por chat.
- [ ] Cola offline + Background Sync para reportes desde la web.
- [ ] **Endpoint público PFIF** (export/import) → invitar a otras plataformas a interoperar.
- [ ] Moderación/antispam: rate-limit, verificación ligera, detección de duplicados al ingresar.
- **DoD:** se reporta por WhatsApp y aparece consolidado en la web; otra plataforma puede consumir nuestro feed PFIF.

### 🟡 Sprint 3 — Logística hiperlocal (días 9–14)
- [ ] Matching de **necesidades de insumos** barrio/refugio en tiempo real (Supabase Realtime) con estados *pedido → en camino → entregado* y expiración.
- [ ] **Registro vivo de refugios**: cupo, servicios (agua/luz/médico), necesidades, "última actualización hace X".
- [ ] Mapa MapLibre + OSM con capas filtrables; clustering de marcadores.
- **DoD:** un refugio publica una necesidad por WhatsApp y un voluntario cercano la ve y la marca "en camino".

### 🟡 Sprint 4 — Confianza y coordinación (días 15–21)
- [ ] **Verificador anti-estafa** de campañas (semáforo verificada / no verificada + reportes ciudadanos). Lenguaje legal prudente.
- [ ] **Coordinación de maquinaria pesada** (registro + solicitudes priorizadas, enganche con CVC/CPV).
- [ ] **Matching de voluntarios** por habilidad + zona con cupos.
- [ ] **Tablero de datos abiertos** para prensa/ONG (cifras agregadas verificadas, exportables).

### 🟢 Sprint 5+ — Reconstrucción (semanas 4+)
- [ ] Seguimiento de damnificados, reconstrucción de viviendas, transparencia de fondos. Pivot cuando los mapas de desaparecidos pierdan relevancia.

---

## 4. Calidad e ingeniería (gates por PR)

- **Tests:** Vitest (unidad, foco en `dedup` y `pfif`), Playwright (e2e de búsqueda y reporte offline). Cobertura mínima 80% en `packages/dedup` y `packages/pfif`.
- **CI:** typecheck + lint + tests + build + Lighthouse CI en cada PR (GitHub Actions). Merge bloqueado si falla.
- **Revisión:** 1 reviewer mínimo; los cambios en dedup o en exposición de datos sensibles requieren 2.
- **Observabilidad:** Sentry (free) para errores; métricas de Web Vitals reales (RUM).
- **Presupuestos:** límites de bundle, LCP y CLS en CI; si se exceden, falla el build.

---

## 5. Seguridad y privacidad (gates)

- RLS en todas las tablas; la API pública nunca devuelve columnas sensibles.
- Enmascarado de cédula/teléfono/dirección; coordenadas aproximadas en puntos sensibles.
- Expiración/borrado por registro (PFIF `expiry_date`); botón "eliminar mi reporte".
- Sin dependencia de VenApp para datos sensibles (antecedente de vigilancia); si publica datos abiertos, se integran solo como fuente de lectura.
- Auditoría de cambios (`report_audit`). Política anti-honeypot: no acumular más datos de los necesarios.

---

## 6. Reparto de equipo (sugerido)

- **Lead / arquitectura + `dedup`/`pfif`** (el corazón del diferenciador).
- **Frontend/PWA + a11y + performance.**
- **Backend/Supabase + RLS + ingesta/importadores.**
- **Bots (WhatsApp/Telegram/USSD).**
- **Diseño/contenido + verificación de datos** (parcial).

---

## 7. Métricas de éxito (no de vanidad)

- Tiempo medio para que una familia confirme el estado de un ser querido.
- % de registros deduplicados correctamente (precisión/recall en muestra etiquetada).
- Nº de plataformas que consumen/publican nuestro feed PFIF (interoperabilidad real).
- Necesidades de insumos resueltas (pedido → entregado) y tiempo medio.
- Reportes de estafa verificados y retirados.

---

## 8. Riesgos y umbrales de decisión

- **Si otra plataforma ya consolida vía PFIF a escala** → abandonar el meta-buscador y volcarse 100% en logística.
- **Si la conectividad sigue caída en zonas clave** → priorizar SMS/USSD sobre web.
- **Falsos positivos de dedup** → nunca fusión automática irreversible; mostrar "posible duplicado" para revisión.
- **Scraping con fricción legal** → preferir acuerdos de interoperabilidad sobre scraping.
- **Carga sobre free tier** → caché agresivo en Cloudflare; vistas materializadas; asumir costo bajo puntual si hace falta.

> **Regla de oro:** ninguna feature debe dar falsa confianza en escenarios de vida o muerte. El software coordina e informa; no rescata.
