import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

// Small presentational button used by the Education and Professional Experience
// tabs to trigger structured extraction from the contact's biography.
export default function ExtractFromBioButton({ onClick, loading, disabled, label = "Extract from Bio" }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
      onClick={onClick}
      disabled={loading || disabled}
      title="Pull structured records out of the contact's biography"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {loading ? "Extracting..." : label}
    </Button>
  );
}