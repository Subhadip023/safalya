import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Backend returns naive datetimes that are actually UTC — append Z if no timezone suffix.
export function parseApiDate(isoString: string): Date {
  const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(isoString);
  return new Date(hasTimezone ? isoString : `${isoString}Z`);
}
