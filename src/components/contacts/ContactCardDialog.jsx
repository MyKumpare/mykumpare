import React, { useState, useMemo, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Download, Printer, Plus, Trash2, GripVertical, Mail, Phone, MapPin, Globe, Building2, User, Award, Briefcase, Contact, Upload,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import { AVAILABLE_FIELDS, FIELD_CATEGORIES, getFieldDef, buildDefaultFields, buildAllFields, getFieldHref, discoverExtraFields } from "./contactCardFields";

const FORMAT_STYLES = [
  { id: "classic", label: "Classic", accent: "#1e3a8a" },
  { id: "modern", label: "Modern", accent: "#0d9488" },
  { id: "minimal", label: "Minimal", accent: "#374151" },
  { id: "bold", label: "Bold", accent: "#7c3aed" },
];

// Module-level cache of auto-discovered Contact fields (fields on real records
// that aren't in the curated catalog). Fetched once per session so every contact
// card dialog reuses it.
let extraFieldsCache = null;

// Resolve the icon component for a field (from the catalog definition)
function getIconForField(fieldId) {
  const def = getFieldDef(fieldId);
  return def?.icon || User;
}

function PhotoBadge({ contact, size = "md", accent, light = false }) {
  const initials = [contact?.first_name?.[0], contact?.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const sizeCls = size === "lg" ? "w-16 h-16 text-xl" : "w-12 h-12 text-base";
  if (contact?.photo_url) {
    return (
      <img
        src={contact.photo_url}
        alt=""
        loading="lazy"
        decoding="async"
        className={`contact-photo ${sizeCls} rounded-full object-cover flex-shrink-0 border-2`}
        style={{ borderColor: accent || "#e5e7eb" }}
      />
    );
  }
  return (
    <div
      className={`${sizeCls} rounded-full flex items-center justify-center flex-shrink-0 border-2 font-bold ${light ? "text-white/90 bg-white/10" : "text-white"}`}
      style={{ backgroundColor: accent || "#9ca3af", borderColor: accent ? `${accent}55` : "#e5e7eb" }}
    >
      {initials}
    </div>
  );
}

function NameHeader({ nameField, contact, accent, layout = "left" }) {
  if (!nameField && !contact?.photo_url) return null;
  const photo = <PhotoBadge contact={contact} accent={accent} />;
  const nameEl = nameField ? (
    <h3 className="text-xl font-bold leading-tight text-gray-900">{nameField.value}</h3>
  ) : null;
  if (layout === "center") {
    return (
      <div className="flex items-center gap-3 justify-center">
        {photo}
        {nameEl}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {photo}
      <div className="min-w-0">{nameEl}</div>
    </div>
  );
}

// Render a field value as a hyperlink when the field is linkable (email/phone/address/website).
function FieldValue({ field, accent, light = false }) {
  const href = getFieldHref(field.id, field.value);
  if (href) {
    const isWeb = href.startsWith("http");
    return (
      <a
        href={href}
        target={isWeb ? "_blank" : undefined}
        rel={isWeb ? "noopener noreferrer" : undefined}
        className="break-words hover:underline"
        style={{ color: light ? "rgba(255,255,255,0.95)" : accent }}
      >
        {field.value}
      </a>
    );
  }
  return <span className="break-words">{field.value}</span>;
}

function CardPreview({ fields, style, contact, accent }) {
  const enabledFields = fields.filter((f) => f.enabled && f.value);
  const nameField = enabledFields.find((f) => f.id === "name");
  const otherFields = enabledFields.filter((f) => f.id !== "name");

  if (style === "modern") {
    return (
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        <div className="h-2" style={{ backgroundColor: accent }} />
        <div className="p-6">
          <NameHeader nameField={nameField} contact={contact} accent={accent} />
          {otherFields.map((f) => {
            const Icon = getIconForField(f.id);
            return (
              <div key={f.id} className="flex items-start gap-2 mt-2 text-sm text-gray-600">
                <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                <FieldValue field={f} accent={accent} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (style === "minimal") {
    return (
      <div className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-md p-8 border border-gray-50">
        <NameHeader nameField={nameField} contact={contact} accent={accent} />
        <div className="w-8 h-0.5 my-3" style={{ backgroundColor: accent }} />
        {otherFields.map((f) => (
          <div key={f.id} className="text-sm text-gray-600 mt-1">
            <FieldValue field={f} accent={accent} />
          </div>
        ))}
      </div>
    );
  }

  if (style === "bold") {
    return (
      <div className="w-full max-w-sm mx-auto rounded-2xl shadow-lg overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}dd)` }}>
        <div className="p-6 text-white">
          <div className="flex items-center gap-3">
            <PhotoBadge contact={contact} accent={accent} light />
            {nameField && <h3 className="text-xl font-bold leading-tight">{nameField.value}</h3>}
          </div>
          {otherFields.map((f) => {
            const Icon = getIconForField(f.id);
            return (
              <div key={f.id} className="flex items-start gap-2 mt-2 text-sm text-white/90">
                <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <FieldValue field={f} accent={accent} light />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // classic
  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-lg shadow-lg p-6 border-t-4" style={{ borderTopColor: accent }}>
      <NameHeader nameField={nameField} contact={contact} accent={accent} layout="center" />
      <div className="mt-3 space-y-1.5">
        {otherFields.map((f) => {
          const Icon = getIconForField(f.id);
          return (
            <div key={f.id} className="flex items-center gap-2 text-sm text-gray-600">
              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
              <FieldValue field={f} accent={accent} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Apply a saved per-user format (style + field id/label/enabled) onto the full
// catalog of fields for the current contact. Uses buildAllFields (every catalog
// field, even ones without a value for this contact) so the user's saved
// selection/order/labels is preserved regardless of which values the contact has.
function applySavedFormat(saved, contact, firms) {
  if (!contact) return { fields: [], style: saved?.style || "classic" };
  const baseFields = buildAllFields(contact, firms);
  if (!saved || !Array.isArray(saved.fields)) {
    // No saved format — fall back to the default (only fields with values)
    return { fields: buildDefaultFields(contact, firms), style: saved?.style || "classic" };
  }
  const byId = {};
  baseFields.forEach((f) => { byId[f.id] = f; });
  const ordered = [];
  const seen = new Set();
  saved.fields.forEach((s) => {
    if (byId[s.id] && !seen.has(s.id)) {
      seen.add(s.id);
      ordered.push({
        ...byId[s.id],
        label: s.label || byId[s.id].label,
        enabled: typeof s.enabled === "boolean" ? s.enabled : byId[s.id].enabled,
      });
    }
  });
  // Do NOT auto-append other populated fields: appending them (and the
  // debounced auto-save that follows) would gradually overwrite the user's
  // saved selection with every field that happens to have a value on the
  // most-recently-viewed contact, so the saved format would drift depending
  // on which contact was opened last. The user's saved field set is the
  // single source of truth; new fields are added explicitly via the picker.
  return { fields: ordered, style: saved.style || "classic" };
}

export default function ContactCardDialog({ contact, firms = [], open, onOpenChange }) {
  const [fields, setFields] = useState(() => buildDefaultFields(contact, firms));
  const [style, setStyle] = useState("classic");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(contact?.photo_url || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [extraFields, setExtraFields] = useState([]);
  const cardRef = useRef(null);
  // True only after the per-user saved format has finished loading (or been
  // confirmed absent). Guards the auto-save so initial defaults can't be
  // written back before the saved format is applied.
  const formatLoadedRef = useRef(false);

  // Auto-discover any Contact fields that exist on real records but are not in
  // the curated catalog, so the picker stays in sync when new fields are added
  // to the Contact entity. Cached module-level so it only fetches once per session.
  const allAvailableFields = useMemo(() => [...AVAILABLE_FIELDS, ...extraFields], [extraFields]);
  const allCategories = useMemo(() => [...new Set(allAvailableFields.map((f) => f.category))], [allAvailableFields]);

  React.useEffect(() => {
    if (!open || extraFieldsCache) {
      if (extraFieldsCache) setExtraFields(extraFieldsCache);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const records = await base44.entities.Contact.list("-updated_date", 100);
        const extra = discoverExtraFields(records);
        extraFieldsCache = extra;
        if (!cancelled) setExtraFields(extra);
      } catch (e) {
        // ignore — curated catalog still works
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Keep local photo in sync when the contact changes
  React.useEffect(() => {
    if (open) setPhotoUrl(contact?.photo_url || "");
  }, [contact, open]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
      if (contact?.id) {
        await base44.entities.Contact.update(contact.id, { photo_url: file_url });
      }
      toast({ title: "✅ Photo updated" });
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || "Could not upload photo.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoUrl("");
    if (contact?.id) {
      try {
        await base44.entities.Contact.update(contact.id, { photo_url: "" });
      } catch (e) {
        // non-fatal
      }
    }
  };

  // Reset the loaded flag whenever the dialog closes so the saved format is
  // re-applied from the user profile on the next open. Without this, the flag
  // stays true for the lifetime of the (always-mounted) dialog and the load
  // effect is skipped on reopen — so any state reset leaves the user looking
  // at defaults instead of their saved format.
  React.useEffect(() => {
    if (!open) {
      formatLoadedRef.current = false;
    }
  }, [open]);

  // Load the per-user saved format on open. The format is stored on the
  // user record at the top level (me.contact_card_format), not under me.data.
  // Waits until a contact is available before applying, so the saved field set
  // maps onto real field values (and isn't dropped when contact arrives late).
  React.useEffect(() => {
    if (!open || formatLoadedRef.current || !contact) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        const saved = me?.contact_card_format;
        if (!cancelled) {
          if (saved) {
            const { fields: applied, style: savedStyle } = applySavedFormat(saved, contact, firms);
            setFields(applied);
            setStyle(savedStyle);
          } else {
            // No saved format — use the defaults for this contact
            setFields(buildDefaultFields(contact, firms));
          }
        }
      } catch (e) {
        // not logged in — keep defaults
        if (!cancelled) setFields(buildDefaultFields(contact, firms));
      } finally {
        if (!cancelled) formatLoadedRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [open, contact]);

  // Rebuild field values when contact changes (after the saved format has
  // loaded), preserving the saved layout/order/enabled/labels and only
  // refreshing the values for the current contact. Uses buildAllFields so saved
  // fields are kept even when the new contact has no value for them.
  React.useEffect(() => {
    if (!open || !contact || !formatLoadedRef.current) return;
    setFields((prev) => {
      if (!prev.length) return buildDefaultFields(contact, firms);
      const byId = {};
      buildAllFields(contact, firms).forEach((f) => { byId[f.id] = f; });
      return prev
        .map((f) => (byId[f.id] ? { ...byId[f.id], label: f.label, enabled: f.enabled } : f))
        .filter((f) => byId[f.id]);
    });
  }, [contact, open]);

  // Persist the current format (style + field id/label/enabled) to the user's profile
  const saveFormat = async (currentStyle, currentFields) => {
    try {
      setSaving(true);
      await base44.auth.updateMe({
        contact_card_format: {
          style: currentStyle,
          fields: currentFields.map((f) => ({ id: f.id, label: f.label, enabled: f.enabled })),
        },
      });
    } catch (e) {
      // non-fatal — format still works in-session
    } finally {
      setSaving(false);
    }
  };

  // Debounced auto-save whenever style or field layout/labels/enabled change.
  // Only fires after the saved format has loaded so defaults are never written
  // back over a real saved format during the initial load.
  React.useEffect(() => {
    if (!open || !formatLoadedRef.current) return;
    const t = setTimeout(() => { saveFormat(style, fields); }, 800);
    return () => clearTimeout(t);
  }, [style, fields, open]);

  const accent = FORMAT_STYLES.find((s) => s.id === style)?.accent || "#1e3a8a";

  const toggleField = (id) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  };

  const updateFieldValue = (id, value) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)));
  };

  const addSelectedField = () => {
    if (!selectedFieldId) {
      toast({ title: "Select a field", description: "Choose a field from the dropdown to add.", variant: "destructive" });
      return;
    }
    if (fields.some((f) => f.id === selectedFieldId)) {
      toast({ title: "Already added", description: "That field is already on the card.", variant: "destructive" });
      return;
    }
    const def = allAvailableFields.find((f) => f.id === selectedFieldId) || getFieldDef(selectedFieldId);
    if (!def) return;
    const value = def.getValue(contact, firms);
    setFields((prev) => [...prev, { id: def.id, label: def.label, value: typeof value === "string" ? value : "", enabled: true }]);
    setSelectedFieldId("");
  };

  const removeField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...fields];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setFields(reordered);
  };

  // Convert an image URL to a same-origin data URL so html2canvas can render it without CORS taint.
  const toDataUrl = (url) =>
    new Promise((resolve) => {
      fetch(url)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("fetch failed"))))
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    });

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      // Preload any <img> in the card as data URLs so the photo renders in the PNG (avoids cross-origin blank).
      const imgs = Array.from(cardRef.current.querySelectorAll("img"));
      const originals = imgs.map((img) => img.src);
      await Promise.all(
        imgs.map(async (img) => {
          if (!img.src || img.src.startsWith("data:")) return;
          const dataUrl = await toDataUrl(img.src);
          if (dataUrl) img.src = dataUrl;
        })
      );
      // Let the swapped data-URL images decode before capture
      await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2, useCORS: true, allowTaint: false });
      // Restore original srcs so the on-screen preview is unaffected
      imgs.forEach((img, i) => { if (img.src !== originals[i]) img.src = originals[i]; });
      const link = document.createElement("a");
      const name = [contact?.first_name, contact?.last_name].filter(Boolean).join("_") || "contact";
      link.download = `${name}_contact_card.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "✅ Contact card downloaded" });
    } catch (err) {
      toast({ title: "Download failed", description: err?.message || "Could not generate image.", variant: "destructive" });
    }
  };

  const handleSyncToOutlook = async () => {
    if (!contact?.id) {
      toast({ title: "Save contact first", description: "The contact must be saved before syncing to Outlook.", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncContactToOutlook", { contact_id: contact.id });
      if (res.data?.notConnected) {
        toast({
          title: "Outlook not authorized",
          description: res.data.scopeError
            ? "Outlook needs the Contacts.ReadWrite permission to sync contacts. Please re-authorize Outlook with the additional scope."
            : "Outlook is not connected. Please connect your Outlook account first.",
          variant: "destructive",
        });
      } else if (res.data?.success) {
        toast({
          title: "✅ Contact synced to Outlook",
          description: `${res.data.display_name || "Contact"} has been added to your Outlook address book.`,
        });
      } else {
        throw new Error(res.data?.error || "Sync failed");
      }
    } catch (err) {
      toast({ title: "Sync failed", description: err?.message || "Could not sync to Outlook.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handlePrint = () => {
    if (!cardRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Contact Card</title>
      <style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f3f4f6;}</style>
      </head><body>${cardRef.current.outerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Contact Card</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 pr-1">
          {/* Left: controls */}
          <div className="space-y-4">
            {/* Format style */}
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Card Format</Label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      style === s.id ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300"
                    }`}
                    style={style === s.id ? { backgroundColor: s.accent } : {}}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo */}
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Card Photo</Label>
              <div className="flex items-center gap-3">
                <PhotoBadge contact={{ ...contact, photo_url: photoUrl }} accent={accent} />
                <div className="flex flex-col gap-1.5">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                    <div className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-indigo-800 font-medium border border-indigo-200 rounded-md px-2.5 py-1.5 hover:bg-indigo-50 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingPhoto ? "Uploading…" : photoUrl ? "Change Photo" : "Upload Photo"}
                    </div>
                  </label>
                  {photoUrl && (
                    <button type="button" onClick={handlePhotoRemove} className="text-xs text-red-500 hover:text-red-700 text-left">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Field management */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-medium text-gray-700">Contact Fields (drag to reorder)</Label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFields((prev) => prev.map((f) => ({ ...f, enabled: true })))}
                    className="text-[11px] font-medium text-primary hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300 text-xs">|</span>
                  <button
                    type="button"
                    onClick={() => setFields((prev) => prev.map((f) => ({ ...f, enabled: false })))}
                    className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
                  >
                    Unselect All
                  </button>
                </div>
              </div>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="contact-card-fields">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                      {fields.map((f, idx) => (
                        <Draggable key={f.id} draggableId={f.id} index={idx}>
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 transition-shadow ${
                                snapshot.isDragging
                                  ? "border-indigo-400 shadow-lg ring-2 ring-indigo-200 z-50"
                                  : "border-gray-200"
                              }`}
                            >
                              <span
                                {...prov.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                                title="Drag to reorder"
                              >
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <input
                                type="checkbox"
                                checked={f.enabled}
                                onChange={() => toggleField(f.id)}
                                className="w-4 h-4 rounded flex-shrink-0"
                              />
                              <Input
                                value={f.label}
                                onChange={(e) => setFields((prev) => prev.map((x) => x.id === f.id ? { ...x, label: e.target.value } : x))}
                                className="h-7 w-28 text-xs"
                                placeholder="Label"
                              />
                              <Input
                                value={f.value}
                                onChange={(e) => updateFieldValue(f.id, e.target.value)}
                                className="h-7 flex-1 text-xs"
                                placeholder="Value"
                              />
                              <button
                                type="button"
                                onClick={() => removeField(f.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-0.5 flex-shrink-0"
                                title="Remove field"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Add field from existing contact fields */}
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-2 py-1.5">
                <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue placeholder="Select a contact field to add…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => {
                      const catFields = allAvailableFields.filter((f) => f.category === cat && !fields.some((existing) => existing.id === f.id));
                      if (!catFields.length) return null;
                      return (
                        <SelectGroup key={cat}>
                          <SelectLabel className="text-xs font-semibold text-gray-500">{cat}</SelectLabel>
                          {catFields.map((f) => (
                            <SelectItem key={f.id} value={f.id} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs flex-shrink-0" onClick={addSelectedField}>
                  Add
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Pick from any field across the contact form, tabs, and sub-forms.</p>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="flex flex-col items-center justify-start gap-3 bg-gray-50 rounded-xl p-4 min-h-[300px]">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview</p>
            <div ref={cardRef} className="w-full">
              <CardPreview fields={fields} style={style} contact={{ ...contact, photo_url: photoUrl }} accent={accent} />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" /> Download PNG
          </Button>
          <Button variant="outline" size="sm" onClick={handleSyncToOutlook} disabled={syncing}>
            <Contact className="w-4 h-4 mr-1" /> {syncing ? "Syncing…" : "Sync to Outlook"}
          </Button>
          <div className="flex-1" />
          {saving && <span className="text-[11px] text-gray-400 self-center">Saving format…</span>}
          {!saving && formatLoadedRef.current && <span className="text-[11px] text-gray-400 self-center">Format saved to your profile</span>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}