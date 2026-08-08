import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Loader2, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Lets the user point the system at a contact's individual profile page URL
// and re-scrape it for biography, education, experience, and designations.
// The bio_url is shown as a clickable link so the user can verify the source.
export default function ScrapeProfileButton({ contactId, bioUrl, onScrapeComplete }) {
  const [url, setUrl] = useState(bioUrl || "");
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const handleScrape = async () => {
    const profileUrl = url.trim();
    if (!profileUrl) {
      toast({ title: "URL required", description: "Enter the contact's profile page URL.", variant: "destructive" });
      return;
    }
    if (!contactId) {
      toast({ title: "Save first", description: "Save the contact before scraping a profile page.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("scrapeContactProfilePage", {
        contact_id: contactId,
        profile_url: profileUrl,
      });
      if (res.data?.error) throw new Error(res.data.error);
      const fields = res.data?.updated_fields || [];
      toast({
        title: "✅ Profile scraped",
        description: fields.length > 0
          ? `Updated: ${fields.join(", ")}`
          : "No new data found on that page.",
      });
      if (onScrapeComplete) onScrapeComplete(res.data);
    } catch (err) {
      toast({
        title: "Scrape failed",
        description: err?.response?.data?.error || err?.message || "Could not scrape the profile page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Profile Page URL</span>
        {bioUrl && !showInput && (
          <button
            type="button"
            className="text-xs text-indigo-600 hover:underline"
            onClick={() => setShowInput(true)}
          >
            Edit
          </button>
        )}
      </div>
      {bioUrl && !showInput ? (
        <div className="flex items-center gap-1.5">
          <a
            href={bioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:underline truncate flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            {bioUrl}
          </a>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Input
            type="url"
            placeholder="https://firm.com/team/contact-name"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={handleScrape}
            disabled={loading || !url.trim()}
            title="Scrape this profile page for bio, education, experience, and designations"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
            {loading ? "Scraping..." : "Scrape"}
          </Button>
        </div>
      )}
    </div>
  );
}