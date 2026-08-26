import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Auto-discovers a contact's biography by scraping their related firm's
// website (people/team page → individual profile), then falling back to a
// general web search. Shown next to the Biography field for existing contacts.
export default function ScrapeBiographyButton({ contactId, onBiographyScraped }) {
  const [loading, setLoading] = useState(false);

  const handleScrape = async () => {
    if (!contactId) {
      toast({ title: "Save first", description: "Save the contact before scraping its biography.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("scrapeContactBiography", { contact_id: contactId });
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      if (data.success) {
        toast({
          title: "✅ Biography found",
          description: data.source === "firm_website"
            ? "Extracted from the firm's website."
            : "Extracted from a general web search.",
        });
        if (onBiographyScraped) onBiographyScraped(data);
      } else {
        toast({
          title: "No biography found",
          description: data.message || "Could not find a biography on the firm website(s) or the web.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Scrape failed",
        description: err?.response?.data?.error || err?.message || "Could not scrape the biography.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
      onClick={handleScrape}
      disabled={loading || !contactId}
      title="Auto-discover this contact's biography from their firm website or the web"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
      {loading ? "Searching..." : "Find Bio on Web"}
    </Button>
  );
}