import type { DocumentClause } from "./templateTypes";

/** Fallback cuando el tenant aún no tiene plantilla en BD. */
export const DEFAULT_CONSIGNACION_CLAUSES: DocumentClause[] = [
  {
    id: "primero",
    title: "PRIMERO",
    body: "El CONSIGNANTE declara ser el legítimo propietario del vehículo individualizado en este instrumento, encontrándose éste libre de gravámenes, prohibiciones y embargos, salvo lo que se indique expresamente en las observaciones.",
  },
  {
    id: "segundo",
    title: "SEGUNDO",
    body: "El CONSIGNATARIO se obliga a exhibir, publicitar y gestionar la venta del vehículo conforme a las políticas comerciales de la automotora, actuando como mandatario de venta en los términos de la legislación vigente.",
  },
  {
    id: "tercero",
    title: "TERCERO",
    body: "El precio de venta sugerido y el precio mínimo acordado entre las partes son los señalados en el presente contrato. Cualquier modificación deberá constar por escrito.",
  },
  {
    id: "cuarto",
    title: "CUARTO",
    body: "La comisión por el servicio de consignación se aplicará sobre el precio final de venta efectivamente percibido, según el porcentaje o monto convenido entre las partes.",
  },
  {
    id: "quinto",
    title: "QUINTO",
    body: "El CONSIGNANTE autoriza la publicación del vehículo en portales, redes y medios que estime conveniente el CONSIGNATARIO, incluyendo el uso de fotografías y datos técnicos del vehículo.",
  },
  {
    id: "sexto",
    title: "SEXTO",
    body: "El presente contrato podrá poner término anticipado por mutuo acuerdo o por incumplimiento grave de cualquiera de las partes, sin perjuicio de las obligaciones ya devengadas.",
  },
];

export const DEFAULT_VENTA_CLAUSES: DocumentClause[] = [
  {
    id: "primero",
    title: "PRIMERO",
    body: "El vendedor declara ser el legítimo dueño del vehículo y que éste se encuentra libre de toda deuda, gravamen o prohibición, salvo lo indicado en observaciones.",
  },
  {
    id: "segundo",
    title: "SEGUNDO",
    body: "El comprador declara haber revisado el vehículo y aceptarlo en las condiciones descritas en este instrumento.",
  },
  {
    id: "tercero",
    title: "TERCERO",
    body: "El precio de venta y la forma de pago son los señalados en la sección de condiciones económicas. El pago se considerará efectuado al acreditarse en la forma convenida.",
  },
];
