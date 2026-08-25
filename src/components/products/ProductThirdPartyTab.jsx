import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";

const FIELDS = [
  { key: "evestment_id", label: "eVestment ID", placeholder: "e.g. 123456-EM" },
  { key: "custodian_id", label: "Custodian ID", placeholder: "e.g. CUST-7890" },
  { key: "aapryl_id", label: "Aapryl ID", placeholder: "e.g. AAP-2024-001" },
  { key: "xponance_internal_id", label: "Xponance Internal ID", placeholder: "e.g. XP-INT-014" },
];

export default function ProductThirdPartyTab({ values, onChange, isEditing }) {
  const v = values || { evestment_id: "", custodian_id: "", aapryl_id: "", xponance_internal_id: "" };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 rounded-md bg-blue-50 border border-blue-100">
        <Building2 className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">
          External and internal identifier references for this product. Use these to cross-link the product with third-party databases and internal tracking systems.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">{f.label}</Label>
            {!isEditing ? (
              <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800 font-medium">
                {v[f.key] || <span className="text-gray-400">—</span>}
              </div>
            ) : (
              <Input
                placeholder={f.placeholder}
                value={v[f.key] || ""}
                onChange={(e) => onChange({ ...v, [f.key]: e.target.value })}
                className="h-9"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}