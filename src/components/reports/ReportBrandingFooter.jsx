import React from "react";
import { MYKUMPARE_LOGO_SRC, MYKUMPARE_BRAND } from "./reportBranding";

/**
 * "Powered by MyKumpare" footer badge for online + printed reports.
 * - Online: renders as a subtle footer row at the bottom of the report content.
 * - Print: a global @media print rule in index.css pins it to the lower-left of
 *   every printed page (class `mykumpare-brand-footer`).
 */
export default function ReportBrandingFooter({ className = "", showBorder = true }) {
  return (
    <div
      className={`mykumpare-brand-footer flex items-center gap-2 mt-6 ${showBorder ? "pt-3 border-t border-gray-200" : ""} ${className}`}
    >
      <img
        src={MYKUMPARE_LOGO_SRC}
        alt={MYKUMPARE_BRAND}
        className="h-5 w-5 rounded-md object-contain"
      />
      <span className="text-[11px] text-gray-500 leading-none">
        Powered by{" "}
        <span className="font-bold text-indigo-600">{MYKUMPARE_BRAND}</span>
      </span>
    </div>
  );
}