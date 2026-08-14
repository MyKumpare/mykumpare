import React, { useRef, useLayoutEffect } from "react";
import { Input } from "@/components/ui/input";

const toNum = (v) => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtCurrency = (n) => {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "";
  const num = Number(n);
  return (num < 0 ? "-$" : "$") + Math.abs(num).toLocaleString("en-US", { maximumFractionDigits: 0 });
};

/**
 * Text input that displays formatted currency ($X,XXX) at all times —
 * including while the user is typing — so large figures stay readable.
 * Cursor position is preserved across the real-time reformatting by
 * tracking the digit count before the caret.
 */
export default function CurrencyInput({ value, onChange, className, placeholder, ...rest }) {
  const inputRef = useRef(null);
  const cursorDigitsRef = useRef(null);

  // After the formatted value re-renders, place the caret so the same
  // number of digits precede it as before the keystroke.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || cursorDigitsRef.current == null) return;
    const formatted = el.value;
    let digitsSeen = 0;
    let pos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/[0-9]/.test(formatted[i])) {
        if (digitsSeen === cursorDigitsRef.current) {
          pos = i;
          break;
        }
        digitsSeen++;
      }
    }
    el.setSelectionRange(pos, pos);
    cursorDigitsRef.current = null;
  });

  const handleChange = (e) => {
    const raw = e.target.value;
    const cursor = e.target.selectionStart ?? 0;
    cursorDigitsRef.current = raw.slice(0, cursor).replace(/[^0-9]/g, "").length;
    onChange?.(toNum(raw));
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      placeholder={placeholder || "$0"}
      value={fmtCurrency(value)}
      {...rest}
      onFocus={(e) => {
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={handleChange}
      className={className}
    />
  );
}