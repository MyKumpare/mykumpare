import React from "react";
import { Label } from "@/components/ui/label";
import { CreatableSelect, CreatableMultiSelect } from "./CreatableSelectField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ASSET_CLASSES = ["Equity", "Fixed Income", "Private Equity", "Private Credit"];
const GEOGRAPHIES = ["Global", "ACWI x US", "Developed Non-US", "Emerging Markets", "Frontier Markets", "US"];
const MARKET_CAPS = ["All Cap", "Large Cap", "Mid-Large Cap", "Mid Cap", "Small-Mid Cap", "Small Cap", "Micro Cap"];
const STYLES = ["Value", "Core", "Growth"];
const INVESTMENT_PROCESSES = ["Quantitative", "Fundamental", "Hybrid"];
const IMPLEMENTATION_PROCESSES = ["Active", "Passive"];
const AAPRYL_STYLES = ["Aggressive Value", "Relative Value", "High Quality Blend", "GARP", "Core Growth", "Aggressive Growth"];
const VEHICLE_OFFERINGS = ["Separate Account", "Integrated Managed Portfolio", "ETF", "Mutual Fund"];

function FieldRow({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyValue({ value }) {
  return (
    <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
      {value || <span className="text-gray-400">—</span>}
    </div>
  );
}

function ReadOnlyMultiValue({ value = [] }) {
  if (!value || value.length === 0) {
    return (
      <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-400">—</div>
    );
  }
  return (
    <div className="min-h-9 px-3 py-2 flex flex-wrap gap-1 rounded-md border bg-gray-50">
      {value.map((v) => (
        <span key={v} className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">{v}</span>
      ))}
    </div>
  );
}

export default function ProductClassificationsTab({ classifications, onChange, isEditing }) {
  const set = (key, val) => onChange({ ...classifications, [key]: val });

  const assetClass = classifications?.asset_class || "";

  return (
    <div className="space-y-4 py-2">
      {/* Asset Class */}
      <FieldRow label="Asset Class">
        {isEditing ? (
          <CreatableSelect
            value={assetClass}
            onChange={(v) => {
              // Reset equity-specific fields when asset class changes
              onChange({ ...classifications, asset_class: v, geography: "", market_cap: "", style: "", investment_process: "", implementation_process: "", aapryl_style: "", vehicle_offerings: [] });
            }}
            options={ASSET_CLASSES}
            placeholder="Select asset class..."
          />
        ) : (
          <ReadOnlyValue value={assetClass} />
        )}
      </FieldRow>

      {/* Equity-specific fields */}
      {(assetClass === "Equity" || (!isEditing && assetClass === "Equity")) && assetClass === "Equity" && (
        <>
          <FieldRow label="Geography">
            {isEditing ? (
              <CreatableSelect value={classifications?.geography || ""} onChange={(v) => set("geography", v)} options={GEOGRAPHIES} placeholder="Select geography..." />
            ) : (
              <ReadOnlyValue value={classifications?.geography} />
            )}
          </FieldRow>

          <FieldRow label="Market Capitalization">
            {isEditing ? (
              <CreatableSelect value={classifications?.market_cap || ""} onChange={(v) => set("market_cap", v)} options={MARKET_CAPS} placeholder="Select market cap..." />
            ) : (
              <ReadOnlyValue value={classifications?.market_cap} />
            )}
          </FieldRow>

          <FieldRow label="Style">
            {isEditing ? (
              <CreatableSelect value={classifications?.style || ""} onChange={(v) => set("style", v)} options={STYLES} placeholder="Select style..." />
            ) : (
              <ReadOnlyValue value={classifications?.style} />
            )}
          </FieldRow>

          <FieldRow label="Investment Approach">
            {isEditing ? (
              <CreatableSelect value={classifications?.investment_process || ""} onChange={(v) => set("investment_process", v)} options={INVESTMENT_PROCESSES} placeholder="Select investment approach..." />
            ) : (
              <ReadOnlyValue value={classifications?.investment_process} />
            )}
          </FieldRow>

          <FieldRow label="Implementation Approach">
            {isEditing ? (
              <Select value={classifications?.implementation_process || ""} onValueChange={(v) => set("implementation_process", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select implementation approach..." />
                </SelectTrigger>
                <SelectContent>
                  {IMPLEMENTATION_PROCESSES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ReadOnlyValue value={classifications?.implementation_process} />
            )}
          </FieldRow>

          <FieldRow label="Aapryl Style Classification">
            {isEditing ? (
              <Select value={classifications?.aapryl_style || ""} onValueChange={(v) => set("aapryl_style", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select Aapryl style..." />
                </SelectTrigger>
                <SelectContent>
                  {AAPRYL_STYLES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ReadOnlyValue value={classifications?.aapryl_style} />
            )}
          </FieldRow>

          <FieldRow label="Vehicle Offerings">
            {isEditing ? (
              <CreatableMultiSelect
                value={classifications?.vehicle_offerings || []}
                onChange={(v) => set("vehicle_offerings", v)}
                options={VEHICLE_OFFERINGS}
                placeholder="Select vehicle offerings..."
              />
            ) : (
              <ReadOnlyMultiValue value={classifications?.vehicle_offerings} />
            )}
          </FieldRow>
        </>
      )}
    </div>
  );
}