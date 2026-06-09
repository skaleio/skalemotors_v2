# Seguimiento de vendedores — UX y persistencia

**Fecha:** 2026-06-01  
**Estado:** Aprobado  
**Alcance:** `SellerFollowUp`, lista activa, panel diario, hooks de notas/checks.

## Objetivo

Corregir cuatro problemas en `/app/vendors/seguimiento`:

1. Notas que no persisten al usar un botón explícito **Guardar nota**.
2. Badge **SEGUIMIENTO LIST** en la lista derecha cuando AM y PM están marcados para la fecha seleccionada.
3. Lista de vendedores no scrolleable (solo 3 de 7 visibles).
4. Calendario que no reabre el checklist al hacer clic de nuevo en el mismo día.

## Decisiones

| Tema | Decisión |
|------|----------|
| Fecha de referencia para badges | Fecha **seleccionada en el calendario** (persiste al cerrar el diálogo) |
| SEGUIMIENTO LIST | AM **y** PM marcados para ese vendedor y fecha |
| Guardado de notas | Solo botón **Guardar nota** (+ Ctrl+Enter); sin auto-save en blur |
| Scroll | `overflow-y-auto` con altura máxima explícita; sin `ScrollArea` sin altura fija |
| Calendario | `onDayClick` además de `onSelect`; mantener `selectedDate` al cerrar diálogo |

## Cambios por archivo

### `SellerFollowUpActiveList.tsx`

- Reemplazar `ScrollArea` por contenedor con `max-h-[min(520px,60vh)] overflow-y-auto`.
- Props opcionales: `checkMap`, `followUpDateLabel`.
- Badge por vendedor: **SEGUIMIENTO LIST** (verde), **AM ✓** / **PM ✓** (parcial), ninguno si sin checks.
- Subtítulo cuando hay fecha: *Estado de seguimiento · [fecha]*.
- Hint de scroll si `sellers.length > 3`.

### `SellerFollowUp.tsx`

- `onDayClick={handleDaySelect}` en `Calendar`.
- Pasar `checkMap={dayCheckMap}` y `followUpDateLabel` a la lista cuando hay `selectedDate`.
- Toast de éxito al guardar nota.
- Actualizar copy del diálogo (checks auto; notas con botón).

### `SellerFollowUpDayPanel.tsx`

- Botón **Guardar nota** debajo del textarea.
- Quitar `onBlur` auto-save.
- Ctrl+Enter guarda nota.

### `useSellerFollowUp.ts`

- Optimistic update en `useSaveSellerFollowUpNote` (cache del mes).

## Criterios de aceptación

- [ ] Lista muestra los 7 vendedores con scroll funcional.
- [ ] Clic repetido en el mismo día del calendario reabre el diálogo.
- [ ] Guardar nota persiste y reaparece al reabrir el día.
- [ ] Con fecha seleccionada y AM+PM marcados, tarjeta muestra **SEGUIMIENTO LIST**.
- [ ] Checks AM/PM parciales muestran badge correspondiente en la lista.

## Fuera de alcance

- Vendedores de plantilla sin usuario CRM vinculado.
- Cambios de RLS o schema en Supabase.
