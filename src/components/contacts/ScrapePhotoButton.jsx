import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Auto-discovers a contact's headshot by scraping their related firm's
// website (people/team page → photo, or individual profile → photo), then
// falling back to a general web search. Shown next to the Upload Photo
// button for existing contacts. Overwrites the current photo only when
// force=true is passed (e.g. a "Find Photo" action on an existing photo).
export default function ScrapePhotoButton({ contactId, hasPhoto, onPhotoScraped }) {
  const [loading, setLoading] = useState(false);

  const handleScrape = async () => {
    if (!contactId) {
      toast({ title: "Save first", description: "Save the contact before scraping its photo.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // If the contact already has a photo, force-overwrite so the user can refresh it.
      const res = await base44.functions.invoke("scrapeContactPhoto", {
        contact_id: contactId,
        force: !!hasPhoto,
      });
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      if (data.success) {
        toast({
          title: "✅ Photo found",
          description: data.source === "firm_website"
            ? "Extracted from the firm's website."
            : "Extracted from a general web search.",
        });
        if (onPhotoScraped) onPhotoScraped(data);
      } else {
        toast({
          title: data.existing_photo ? "Photo already set" : "No photo found",
          description: data.message || "Could not find a photo on the firm website(s) or the web.",
          variant: data.existing_photo ? "default" : "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Scrape failed",
        description: err?.response?.data?.error || err?.message || "Could not scrape the photo.",
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
      className="h-8 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
      onClick={handleScrape}
      disabled={loading || !contactId}
      title="Auto-discover this contact's photo from their firm website or the web"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
      {loading ? "Searching..." : "Find Photo"}
    </Button>
  );
}