// Phone mask: +5516992974306 → +55 (16) 9 9297-4306
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `+${digits}`;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
  if (digits.length <= 5) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  if (digits.length <= 10) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 5)} ${digits.slice(5, 9)}-${digits.slice(9, 13)}`;
}

// Currency mask (Brazilian format): 105452 → 1.054,52
export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const cents = digits.padStart(2, "0");
  const integerPart = cents.slice(0, -2);
  const decimalPart = cents.slice(-2);
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedInteger},${decimalPart}`;
}

// Revert currency mask to cents (for saving)
export function unmaskCurrency(value: string): string {
  return value.replace(/\D/g, "");
}

// Extract raw digits from phone mask
export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, "");
}
