import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera, Upload, Search, UserPlus, RefreshCw, Loader2, AlertTriangle, UserCheck, ArrowLeft,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

function formatName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean).join(" ");
}

function ConfidenceBadge({ score }) {
  const tone = score >= 75
    ? "bg-green-100 text-green-700 border-green-200"
    : score >= 50
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${tone}`}>
      {score}% match
    </span>
  );
}

export default function PhotoCaptureModal({ open, onOpenChange, contacts, onContactClick, onAddContactWithPhoto }) {
  const [stage, setStage] = useState("capture"); // capture | review | searching | results
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const [searchProgress, setSearchProgress] = useState({ done: 0, total: 0 });
  const [contactQuery, setContactQuery] = useState("");
  const [savingContactId, setSavingContactId] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setCameraError(true);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setStage("capture");
      setCapturedUrl(null);
      setMatches([]);
      setError(null);
      setCameraError(false);
      setSearchProgress({ done: 0, total: 0 });
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const uploadFile = async (file) => {
    try {
      setError(null);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      stopCamera();
      setCapturedUrl(file_url);
      setStage("review");
    } catch (e) {
      setError("Failed to upload photo: " + (e.message || "unknown error"));
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) uploadFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const searchContacts = async () => {
    const withPhotos = (contacts || []).filter((c) => c.photo_url && !c.deleted_at);
    if (withPhotos.length === 0) {
      setError("No contacts with photos in the database to compare against.");
      return;
    }
    setStage("searching");
    setError(null);
    setSearchProgress({ done: 0, total: withPhotos.length });
    const BATCH = 3;
    const allMatches = [];
    let failedBatches = 0;
    for (let i = 0; i < withPhotos.length; i += BATCH) {
      const batch = withPhotos.slice(i, i + BATCH);
      const file_urls = [capturedUrl, ...batch.map((c) => c.photo_url)];
      const prompt = `The FIRST image (index 1) is a reference photo of a person. Images 2 through ${batch.length + 1} are photos of contacts from a database. For EACH image from index 2 onward, compare it to the first image and determine how likely it is the SAME person. Return a confidence score from 0 to 100. Only include entries with confidence >= 20.`;
      const schema = {
        type: "object",
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                image_index: { type: "number", description: "1-based index into file_urls (2 = second image)" },
                confidence: { type: "number", description: "0-100" },
                reason: { type: "string" },
              },
            },
          },
        },
      };
      let res = null;
      for (let attempt = 0; attempt < 2 && !res; attempt++) {
        try {
          res = await base44.integrations.Core.InvokeLLM({
            prompt, file_urls, response_json_schema: schema,
          });
        } catch (batchErr) {
          if (attempt === 1) failedBatches++;
        }
      }
      if (res) {
        for (const m of res?.matches || []) {
          const idx = m.image_index - 2;
          if (idx >= 0 && idx < batch.length && m.confidence >= 20) {
            allMatches.push({ contact: batch[idx], confidence: m.confidence, reason: m.reason });
          }
        }
      }
      setSearchProgress({ done: Math.min(i + BATCH, withPhotos.length), total: withPhotos.length });
    }
    allMatches.sort((a, b) => b.confidence - a.confidence);
    setMatches(allMatches.slice(0, 8));
    setStage("results");
    if (failedBatches > 0 && allMatches.length === 0) {
      setError(`Search failed after retrying ${failedBatches} batch(es). Please try again or add as a new contact.`);
      setStage("review");
    } else if (failedBatches > 0) {
      setError(`${failedBatches} batch(es) were skipped due to errors, but ${allMatches.length} match(es) were found.`);
    }
  };

  const handleAddAsNew = () => {
    onAddContactWithPhoto(capturedUrl);
    onOpenChange(false);
  };

  const filteredContacts = (contacts || [])
    .filter((c) => !c.deleted_at)
    .filter((c) => {
      if (!contactQuery.trim()) return true;
      const q = contactQuery.toLowerCase();
      const name = formatName(c).toLowerCase();
      const firm = (c.firm_ids || []).length ? "" : "";
      return name.includes(q) || (c.title || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
    })
    .sort((a, b) => formatName(a).localeCompare(formatName(b), undefined, { sensitivity: "base" }))
    .slice(0, 50);

  const handleSaveToContact = async (contact) => {
    try {
      setSavingContactId(contact.id);
      setError(null);
      await base44.entities.Contact.update(contact.id, { photo_url: capturedUrl });
      onContactClick({ ...contact, photo_url: capturedUrl });
      onOpenChange(false);
    } catch (e) {
      setError("Failed to save photo: " + (e.message || "unknown error"));
    } finally {
      setSavingContactId(null);
    }
  };

  const retake = () => {
    setStage("capture");
    setCapturedUrl(null);
    setMatches([]);
    setError(null);
    startCamera();
  };

  const contactsWithPhotos = (contacts || []).filter((c) => c.photo_url && !c.deleted_at);

  const isBusy = stage === "searching";

  const handleOpenChange = (next) => {
    if (isBusy && !next) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => { if (isBusy) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isBusy) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isBusy) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-500" />
            Photo Identification
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {stage === "capture" && (
          <div className="space-y-3">
            {cameraError ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">Camera access unavailable. Upload a photo instead.</p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-[3/4]">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover -scale-x-100" />
              </div>
            )}
            <div className="flex gap-2">
              {!cameraError && (
                <Button onClick={captureFromVideo} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                  <Camera className="w-4 h-4" /> Capture
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 gap-2"
              >
                <Upload className="w-4 h-4" /> Upload Photo
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
        )}

        {stage === "review" && capturedUrl && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-gray-100">
              <img src={capturedUrl} alt="Captured" className="w-full object-contain max-h-72" />
            </div>
            <p className="text-xs text-gray-500 text-center">
              {contactsWithPhotos.length} contact{contactsWithPhotos.length !== 1 ? "s" : ""} with photos available to search.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={searchContacts}
                disabled={contactsWithPhotos.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
                <Search className="w-4 h-4" /> Search Existing Contacts
              </Button>
              <Button onClick={handleAddAsNew} variant="outline" className="w-full gap-2">
                <UserPlus className="w-4 h-4" /> Add as New Contact
              </Button>
              <Button onClick={() => { setStage("select-contact"); setContactQuery(""); }} variant="ghost" size="sm" className="w-full gap-2 text-indigo-600 hover:text-indigo-700">
                <UserCheck className="w-4 h-4" /> Add to Existing Contact
              </Button>
              <Button onClick={retake} variant="ghost" size="sm" className="w-full gap-1 text-gray-500">
                <RefreshCw className="w-3.5 h-3.5" /> Retake Photo
              </Button>
            </div>
          </div>
        )}

        {stage === "select-contact" && capturedUrl && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button onClick={() => setStage("review")} variant="ghost" size="sm" className="gap-1 px-2 text-gray-500">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </div>
            <div className="rounded-xl overflow-hidden bg-gray-100 max-h-32">
              <img src={capturedUrl} alt="Captured" className="w-full object-contain max-h-32" />
            </div>
            <Input
              autoFocus
              placeholder="Search contacts by name, title, or email..."
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No contacts found.</p>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSaveToContact(c)}
                    disabled={savingContactId !== null}
                    className="w-full flex items-center gap-3 p-2 rounded-xl border border-gray-100 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-left disabled:opacity-50"
                  >
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{formatName(c)}</div>
                      {c.title && <div className="text-xs text-gray-400 truncate">{c.title}</div>}
                    </div>
                    {savingContactId === c.id ? (
                      <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {stage === "searching" && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Searching contacts...</p>
            <p className="text-xs text-gray-400 mt-1">
              Compared {searchProgress.done} of {searchProgress.total} contacts
            </p>
          </div>
        )}

        {stage === "results" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {matches.length > 0
                ? "Top matches found. Tap a contact to view their record."
                : "No matching contacts found. Try adding as a new contact."}
            </p>
            {matches.map((m, i) => (
              <button
                key={i}
                onClick={() => { onContactClick(m.contact); onOpenChange(false); }}
                className="w-full flex items-center gap-3 p-2 rounded-xl border border-gray-100 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-left"
              >
                <img src={m.contact.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{formatName(m.contact)}</div>
                  {m.contact.title && <div className="text-xs text-gray-400 truncate">{m.contact.title}</div>}
                </div>
                <ConfidenceBadge score={m.confidence} />
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={retake} variant="outline" className="flex-1 gap-2">
                <RefreshCw className="w-4 h-4" /> Try Another
              </Button>
              <Button onClick={handleAddAsNew} className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                <UserPlus className="w-4 h-4" /> Add New
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}