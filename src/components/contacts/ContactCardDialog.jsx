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
  Download, Printer, Plus, Trash2, GripVertical, Mail, Phone, MapPin, Globe, Building2, User, Award, Briefcase, Contact,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import { AVAILABLE_FIELDS, FIELD_CATEGORIES, getFieldDef, buildDefaultFields } from "./contactCardFields";

const FORMAT_STYLES = [
  { id: "classic", label: "Classic", accent: "#1e3a8a" },
  { id: "modern", label: "Modern", accent: "#0d9488" },
  { id: "minimal", label: "Minimal", accent: "#374151" },
  { id: "bold", label: "Bold", accent: "#7c3aed" },
];

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
        className={`${sizeCls} rounded-full object-cover flex-shrink-0 border-2`}
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
                <span className="break-words">{f.value}</span>
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
          <div key={f.id} className="text-sm text-gray-600 mt-1 break-words">{f.value}</div>
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
                <span className="break-words">{f.value}</span>
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
              <span className="break-words">{f.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ContactCardDialog({ contact, firms = [], open, onOpenChange }) {
  const [fields, setFields] = useState(() => buildDefaultFields(contact, firms));
  const [style, setStyle] = useState("classic");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const cardRef = useRef(null);

  // Rebuild fields when contact changes
  React.useEffect(() => {
    if (open && contact) {
      setFields(buildDefaultFields(contact, firms));
    }
  }, [open, contact]);

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
    const def = getFieldDef(selectedFieldId);
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

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
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

            {/* Field management */}
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Contact Fields (drag to reorder)</Label>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="contact-card-fields">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                      {fields.map((f, idx) => (
                        <Draggable key={f.id} draggableId={f.id} index={idx}>
                          {(prov) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5"
                            >
                              <span {...prov.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500">
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <input
                                type="checkbox"
                                checked={f.enabled}
                                onChange={() => toggleField(f.id)}
                                className="w-4 h-4 rounded"
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
                                className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
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
                    {FIELD_CATEGORIES.map((cat) => {
                      const catFields = AVAILABLE_FIELDS.filter((f) => f.category === cat && !fields.some((existing) => existing.id === f.id));
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
              <CardPreview fields={fields} style={style} contact={contact} accent={accent} />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}