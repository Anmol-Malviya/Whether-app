/**
 * Formats a Date or ISO timestamp string into 12-hour AM/PM format.
 * Example: "11-10 10:00 AM" or "10:00:15 AM"
 */

export function formatTime12h(
  dateInput: string | Date | null | undefined,
  options?: {
    includeDate?: boolean;
    includeSeconds?: boolean;
    useUtc?: boolean;
  }
): string {
  if (!dateInput) return "—";

  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "N/A";

  const includeDate = options?.includeDate ?? true;
  const includeSeconds = options?.includeSeconds ?? false;
  const useUtc = options?.useUtc ?? false;

  const intlOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...(includeSeconds ? { second: "2-digit" } : {}),
    ...(includeDate ? { month: "2-digit", day: "2-digit" } : {}),
    ...(useUtc ? { timeZone: "UTC" } : {}),
  };

  const formatted = d.toLocaleString("en-US", intlOptions);
  // Replaces "11/10/2026, 10:00 AM" or "11/10, 10:00 AM" cleanly
  return formatted.replace(",", "").replace(/\//g, "-");
}

export function formatUtcTime12h(
  dateInput: string | Date | null | undefined,
  includeDate: boolean = true
): string {
  return formatTime12h(dateInput, { includeDate, useUtc: true });
}

