import { useEffect, useMemo, useState } from "react";

// Paginación client-side para listas ya cargadas. No hace fetch nuevo; solo
// rebana el array. Se usa cuando una tabla puede tener 200+ filas y el render
// del DOM completo causa lag (típico Leads, Inventory, Finance al crecer).
export function usePagination<T>(items: T[], initialPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Si los filtros bajan el total y la página actual queda fuera de rango,
  // volver a la 1 para no quedar en una página vacía.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    pagedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
  };
}
