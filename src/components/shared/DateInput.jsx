import React, { useState, useEffect } from "react";
import { format, parse, parseISO, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Auto-format a raw string into MM/DD/YYYY as the user types.
 * Strips non-digits, then inserts slashes after MM and DD.
 */
function autoFormat(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
}

/** Parse a MM/DD/YYYY display string into an ISO yyyy-MM-dd string (or null). */
function parseDisplay(str) {
  if (!str) return null;
  const d = parse(str, "MM/dd/yyyy", new Date());
  if (isValid(d)) return format(d, "yyyy-MM-dd");
  try {
    const d2 = parseISO(str);
    if (isValid(d2)) return format(d2, "yyyy-MM-dd");
  } catch {}
  return null;
}

function isoToDisplay(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MM/dd/yyyy") : iso;
}

/**
 * Date input with auto-formatting (type "12312025" → "12/31/2025", no slashes
 * needed) and an attached calendar picker using the app's Calendar + Popover.
 *
 * Value is an ISO date string (YYYY-MM-DD); display is MM/DD/YYYY.
 * onChange is called with an ISO string only when a complete valid date is
 * entered (or "" when cleared).
 */
export default function DateInput({ value, onChange, placeholder = "MM/DD/YYYY", className, ...rest }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(isoToDisplay(value));

  useEffect(() => {
    setDraft(isoToDisplay(value));
  }, [value]);

  const selectedDate = value ? parseISO(value) : undefined;
  const isValidDate = selectedDate && isValid(selectedDate);

  const handleSelect = (date) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  const handleChange = (e) => {
    const formatted = autoFormat(e.target.value);
    setDraft(formatted);
    const iso = parseDisplay(formatted);
    if (iso) onChange(iso);
    else if (formatted === "") onChange("");
  };

  return (
    <div className="relative w-full">
      <Input
        type="text"
        placeholder={placeholder}
        value={draft}
        onChange={handleChange}
        onBlur={() => setDraft(isoToDisplay(value))}
        className={cn("pr-8", className)}
        {...rest}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-600"
            aria-label="Pick date"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={isValidDate ? selectedDate : undefined}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}