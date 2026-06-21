import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore"
import type { OrderItem } from "@/types"

// Shadcn utility — merges Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formats a number as Malaysian Ringgit (e.g., RM 5,000.00)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amount)
}

// Formats a Date or Firebase Timestamp into "14 Mar 2026"
export function formatDate(date: Date | Timestamp): string {
  const jsDate = date instanceof Timestamp ? date.toDate() : date;
  return jsDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// Calculates subtotal, applies discount + shipping, and returns the grand total and deposit tracking
export function calculateOrderTotals(
  items: OrderItem[],
  discount: number = 0,
  shippingCost: number = 0,
  deposit: number = 0
): { subtotal: number; discount: number; shippingCost: number; grandTotal: number; deposit: number } {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )
  const grandTotal = Math.max(subtotal - discount + shippingCost, 0)
  return { subtotal, discount, shippingCost, grandTotal, deposit }
}

// Converts a Date or Firebase Timestamp to a JS Date (safe for unknown shapes)
export function toJsDate(date: Date | Timestamp | undefined | null): Date | null {
  if (!date) return null;
  if (date instanceof Timestamp) return date.toDate();
  if (date instanceof Date) return date;
  // Firestore raw object fallback { seconds, nanoseconds }
  const anyDate = date as unknown as { seconds?: number };
  if (anyDate && typeof anyDate.seconds === "number") return new Date(anyDate.seconds * 1000);
  return null;
}

// Converts a YYYY-MM-DD form string to a Firestore Timestamp
export function dateStringToTimestamp(value?: string): Timestamp | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return Timestamp.fromDate(d);
}

// Returns a YYYY-MM-DD string for use in <input type="date">
export function toDateInputValue(date?: Date | Timestamp | null): string {
  const d = toJsDate(date ?? null);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

// Days between two dates, inclusive
export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// Generates a document reference: RZ/[TYPE]/[YY]/[PADDED_NUMBER]
// e.g. type='QT', sequenceNumber=89 → RZ/QT/26/089
// Automatically uses current year's last 2 digits
export function generateDocReference(type: "QT" | "OR", sequenceNumber: number): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const padded = String(sequenceNumber).padStart(3, "0")
  return `BZT/${type}/${year}/${padded}`
}
