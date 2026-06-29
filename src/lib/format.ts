export const formatCLP = (amount: number): string => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const sanitizeIntegerInput = (value: string): string => {
  return value.replace(/\D/g, "");
};

// Patente chilena: deja solo alfanumérico en mayúsculas (valor para guardar/consultar).
export const normalizePatente = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Formatos de patente única (PPU) chilena que aceptamos:
//   AB1234   auto/camioneta antiguo (2 letras + 4 dígitos, pre-2007)
//   BCDF12   auto/camioneta actual  (4 letras + 2 dígitos, desde 2007)
//   ABC123   buses/comerciales      (3 letras + 3 dígitos)
//   AB123    motos antiguas         (2 letras + 3 dígitos)
//   ABC12    motos actuales         (3 letras + 2 dígitos)
export const PATENTE_REGEX =
  /^([A-Z]{2}\d{4}|[A-Z]{4}\d{2}|[A-Z]{3}\d{3}|[A-Z]{2}\d{3}|[A-Z]{3}\d{2})$/;

// Valida una patente chilena tras normalizarla. Tolerante a los distintos
// formatos (auto antiguo/nuevo, moto, comercial), no solo al actual de autos.
export const isValidPatente = (value: string): boolean =>
  PATENTE_REGEX.test(normalizePatente(value));

// Máscara de visualización en pares: "jhgf22" → "JH-GF-22".
export const formatPatente = (value: string): string => {
  const clean = normalizePatente(value).slice(0, 6);
  return clean.match(/.{1,2}/g)?.join("-") ?? clean;
};

export const sanitizeDecimalInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.,]/g, "");
  const normalized = cleaned.replace(/,/g, ".");
  const parts = normalized.split(".");
  if (parts.length <= 1) {
    return normalized;
  }
  return `${parts[0]}.${parts.slice(1).join("")}`;
};

export const formatPhone = (phone: string): string => {
  if (phone.startsWith("+56")) {
    const number = phone.slice(3);
    if (number.length === 9) {
      return `+56 ${number.slice(0, 1)} ${number.slice(1, 5)} ${number.slice(5)}`;
    }
  }
  return phone;
};

export const formatRUT = (rut: string): string => {
  const clean = rut.replace(/[^0-9kK]/g, "");
  if (clean.length < 2) return rut;

  const dv = clean.slice(-1).toUpperCase();
  const numbers = clean.slice(0, -1);
  const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted}-${dv}`;
};

/** Title Case simple: cada palabra con la inicial en mayúscula. */
export const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/**
 * Sanea un nombre de persona para guardar/mostrar: descarta emojis, símbolos
 * y caracteres de control (todo lo que no sea letra/número/espacio/`.'-`),
 * colapsa espacios y aplica Title Case. Devuelve "" si no queda nada útil.
 */
export const sanitizeName = (value: string | null | undefined): string => {
  if (!value) return "";
  const cleaned = String(value)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return toTitleCase(cleaned);
};

const VEHICLE_ACRONYMS = new Set([
  "BMW", "BYD", "GAC", "JAC", "JMC", "KIA", "MG", "DFSK", "GMC", "RAM", "DS",
]);

/**
 * Normaliza marca/modelo de vehículo a un formato consistente preservando
 * siglas (BMW, KIA) y códigos alfanuméricos (RAV4, CX5, X3, GLC300).
 */
export const formatVehicleLabel = (value: string | null | undefined): string => {
  if (!value) return "";
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (VEHICLE_ACRONYMS.has(upper)) return upper;
      if (/\d/.test(part) || part.length <= 2) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
};
