export const formatCLP = (amount: number): string => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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


