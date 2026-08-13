import React, { useState } from "react";
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
 * Text input that displays formatted currency ($X,XXX) when not focused and
 * a raw number while editing (selected on focus for quick replacement).
 */
export default function CurrencyInput({ value, onChange, className, placeholder }) {
  const [focused, setFocused] = useState(false);
  const display = focused
    ? (value === null || value === undefined ? "" : String(value))
    : fmtCurrency(value);
  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder || "$0"}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setTimeout(() => e.target.select(), 0);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange?.(toNum(e.target.value))}
      className={className}
    />
  );
}