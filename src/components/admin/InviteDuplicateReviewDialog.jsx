import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, Check, UserPlus, X } from "lucide-react";

// Shown when an email invite matches an existing contact (same/similar name or email).
// Lets the user reuse the existing contact, create a new one anyway, or cancel.
export default function InviteDuplicateReviewDialog({ duplicates, onUseExisting, onCreateNew, onCancel }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Possible Duplicate Contact
          </h3>
          <button onClick={onCancel}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <p className="text-xs text-gray-500">
          A contact with the same or similar name or email already exists. Choose whether to
          invite the existing contact or create a new one.
        </p>

        <div className="space-y-2">
          {duplicates.map((d, i) => (
            <div key={d.contact.id || i} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {d.contact.photo_url
                    ? <img src={d.contact.photo_url} alt="" className="w-full h-full object-cover" />
                    : <User className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 truncate">{d.name}</div>
                  {d.email && <div className="text-xs text-gray-500 truncate">{d.email}</div>}
                </div>
              </div>
              <ul className="text-[11px] text-amber-700 list-disc pl-4 space-y-0.5">
                {d.reasons.map((r, ri) => <li key={ri}>{r}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button" size="sm"
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white justify-start"
            onClick={() => onUseExisting(duplicates[0].contact)}
          >
            <Check className="w-4 h-4" /> Use existing contact
          </Button>
          <Button
            type="button" size="sm" variant="outline"
            className="h-8 text-xs justify-start"
            onClick={onCreateNew}
          >
            <UserPlus className="w-4 h-4" /> Create new contact anyway
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}