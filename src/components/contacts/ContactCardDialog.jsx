import React, { useState, useMemo, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download, Printer, Plus, Trash2, GripVertical, Mail, Phone, MapPin, Globe, Building2, User, Award, Briefcase,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const FORMAT_STYLES = [
  { id: "classic", label: "Classic", accent: "#1e3a8a" },
  { id: "modern", label: "Modern", accent: "#0d9488" },
  { id: "minimal", label: "Minimal", accent: "#374151" },
  { id: "bold", label: "Bold", accent: "#7c3aed" },
];

const FIELD_ICONS = {
  name: User,
  designations: Award,
  company: Building2,
  title: Briefcase,
  email: Mail,
  phone: Phone,
  address: MapPin,
  website: Globe,
};

function buildDefaultFields(contact, firms) {
  const firm = firms?.find((f) => (contact.firm_ids || []).includes(f.id));
  const defaultPhone = (contact.phones || []).find((p) => p.is_default) || (contact.phones || [])[0];
  const phoneStr = defaultPhone
    ? [defaultPhone.country_code ? `+${defaultPhone.country_code}` : null, defaultPhone.area_code ? `(${defaultPhone.area_code})` : null, [defaultPhone.number_mid, defaultPhone.number_last].filter(Boolean).join("-") || null].filter(Boolean).join(" ")
    : "";
  const primaryAddr = (contact.addresses || []).find((a) => a.is_primary) || (contact.addresses || [])[0];
  const addrStr = primaryAddr
    ? [primaryAddr.address_line1, primaryAddr.address_line2, [primaryAddr.city, primaryAddr.state].filter(Boolean).join(", "), [primaryAddr.postal_code, primaryAddr.country].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : "";
  const fullName = [contact.salutation, contact.first_name, contact.middle_name, contact.last_name].filter(Boolean).join(" ") + (contact.suffix ? `, ${contact.suffix}` : "");
  const firmName = firm?.name || (contact.firm_ids || []).map((id) => firms?.find((f) => f.id === id)?.name).filter(Boolean).join(", ");

  return [
    { id: "name", label: "Full Name", value: fullName, enabled: true },
    { id: "designations", label: "Designations", value: (contact.designations || []).join(", "), enabled: !!(contact.designations || []).length },
    { id: "company", label: "Company", value: firmName, enabled: !!firmName },
    { id: "title", label: "Title", value: contact.title || "", enabled: !!contact.title },
    { id: "email", label: "Email", value: contact.email || "", enabled: !!contact.email },
    { id: "phone", label: "Phone", value: phoneStr, enabled: !!phoneStr },
    { id: "address", label: "Address", value: addrStr, enabled: !!addrStr },
    { id: "website", label: "Website", value: firm?.website || "", enabled: !!firm?.website },
  ].filter((f) => f.value || f.id === "name");
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
          {nameField && (
            <h3 className="text-xl font-bold text-gray-900 leading-tight">{nameField.value}</h3>
          )}
          {otherFields.map((f) => {
            const Icon = FIELD_ICONS[f.id] || User;
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
        {nameField && (
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{nameField.value}</h3>
        )}
        <div className="w-8 h-0.5 mb-3" style={{ backgroundColor: accent }} />
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
          {nameField && (
            <h3 className="text-xl font-bold leading-tight">{nameField.value}</h3>
          )}
          {otherFields.map((f) => {
            const Icon = FIELD_ICONS[f.id] || User;
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
      {nameField && (
        <h3 className="text-xl font-bold text-gray-900 text-center leading-tight">{nameField.value}</h3>
      )}
      <div className="mt-3 space-y-1.5">
        {otherFields.map((f) => {
          const Icon = FIELD_ICONS[f.id] || User;
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
  const [customLabel, setCustomLabel] = useState("");
  const [customValue, setCustomValue] = useState("");
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

  const addCustomField = () => {
    if (!customLabel.trim()) {
      toast({ title: "Label required", description: "Enter a label for the custom field.", variant: "destructive" });
      return;
    }
    setFields((prev) => [...prev, { id: `custom-${crypto.randomUUID()}`, label: customLabel.trim(), value: customValue.trim(), enabled: true, custom: true }]);
    setCustomLabel("");
    setCustomValue("");
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

              {/* Add custom field */}
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-2 py-1.5">
                <Plus className="w-4 h-4 text-gray-400" />
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="h-7 w-28 text-xs"
                  placeholder="Field label"
                />
                <Input
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="h-7 flex-1 text-xs"
                  placeholder="Field value"
                  onKeyDown={(e) => { if (e.key === "Enter") addCustomField(); }}
                />
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addCustomField}>
                  Add
                </Button>
              </div>
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
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}