import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Auto-discovers a contact's headshot. When a LinkedIn profile URL is
// available, it opens that LinkedIn profile and extracts the photo from it
// first (linkedinProfilePhoto backend function). When no LinkedIn URL is
// present (or the LinkedIn extraction fails), it falls back to scraping the
// related firm's website (people/team page → photo) and then a general web
// search (scrapeContactPhoto). Shown next to the Upload Photo button for
// existing contacts. Overwrites the current photo only when force=true is
// passed (e.g. a "Find Photo" action on an existing photo).
export default function ScrapePhotoButton({ contactId, hasPhoto, onPhotoScraped, linkedinUrl, firmId, website, firstName, lastName }) {
  const [loading, setLoading] = useState(false);

  // Pull the headshot directly from the contact's LinkedIn profile page.
  // Returns { photo_url, source } or { photo_url: "", message }.
  const tryLinkedinPhoto = async () => {
    const res = await base44.functions.invoke("linkedinProfilePhoto", {
      linkedin_url: (linkedinUrl || "").trim(),
      firm_id: firmId || "",
      website: website || "",
      first_name: (firstName || "").trim(),
      last_name: (lastName || "").trim(),
    });
    const data = res.data || {};
    if (data.photo_url) {
      // Persist the extracted photo to the contact so it sticks even if the
      // user closes the form without saving (matches scrapeContactPhoto).
      try {
        await base44.entities.Contact.update(contactId, { photo_url: data.photo_url });
      } catch { /* local state still updates via callback */ }
      return { photo_url: data.photo_url, source: data.source || "linkedin" };
    }
    return null;
  };

  const handleScrape = async () => {
    if (!contactId) {
      toast({ title: "Save first", description: "Save the contact before scraping its photo.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const hasLinkedin = !!(linkedinUrl && linkedinUrl.trim());

      // 1. Prefer the LinkedIn profile when a link is on file.
      if (hasLinkedin) {
        try {
          const linked = await tryLinkedinPhoto();
          if (linked) {
            toast({
              title: "✅ Photo found",
              description: "Extracted from the LinkedIn profile.",
            });
            if (onPhotoScraped) onPhotoScraped({ success: true, ...linked });
            return;
          }
        } catch (err) {
          // Fall through to the firm-website / web fallback below.
          console.warn("LinkedIn photo extraction failed, falling back to web search", err);
        }
      }

      // 2. Fallback: firm website → general web search. If the contact
      //    already has a photo, force-overwrite so the user can refresh it.
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
          description: hasLinkedin
            ? (data.message || "Could not find a photo on the LinkedIn profile, firm website(s), or the web.")
            : (data.message || "Could not find a photo on the firm website(s) or the web."),
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
      title={linkedinUrl ? "Extract this contact's photo from their LinkedIn profile" : "Auto-discover this contact's photo from their firm website or the web"}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
      {loading ? "Searching..." : "Find Photo"}
    </Button>
  );
}