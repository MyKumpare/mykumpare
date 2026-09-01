import React, { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, FileText, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { generateVCard, downloadVCard, VCARD_FIELD_LABELS } from "./vCardExport";
import { toast } from "@/components/ui/use-toast";

const DEFAULT_FIELD_ORDER = ["title", "company", "email", "phone", "address", "website", "notes"];

export default function VCardPreviewDialog({ contact, firms = [], open, onOpenChange }) {
  const [copied, setCopied] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);
  const [fieldOrder, setFieldOrder] = useState(DEFAULT_FIELD_ORDER);

  // Which fields are available for this contact (have data)
  const availableFields = useMemo(() => {
    if (!contact) return [];
    const has = {
      title: !!contact.title,
      company: (contact.firm_ids || []).some((id) => firms.find((f) => f.id === id)?.name),
      email: !!contact.email,
      phone: (contact.phones || []).some((p) => [p.country_code, p.area_code, p.number_mid, p.number_last].some(Boolean)),
      address: (contact.addresses || []).some((a) => a.address_line1 || a.city || a.state),
      website: !!contact.linkedin_url,
      notes: !!contact.notes,
    };
    return DEFAULT_FIELD_ORDER.filter((id) => has[id]);
  }, [contact, firms]);

  // Reset field order when contact changes
  React.useEffect(() => {
    if (open && contact) {
      setFieldOrder(DEFAULT_FIELD_ORDER);
    }
  }, [open, contact]);

  const orderedAvailableFields = useMemo(() => {
    return fieldOrder.filter((id) => availableFields.includes(id));
  }, [fieldOrder, availableFields]);

  const vcardText = useMemo(() => {
    if (!contact) return "";
    return generateVCard(contact, firms, orderedAvailableFields);
  }, [contact, firms, orderedAvailableFields]);

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...orderedAvailableFields];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    // Merge back with any fields not in availableFields to keep the full array
    const newOrder = [...reordered];
    fieldOrder.forEach((id) => {
      if (!availableFields.includes(id) && !newOrder.includes(id)) {
        newOrder.push(id);
      }
    });
    setFieldOrder(newOrder);
  };

  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Contact"
    : "";

  const readableInfo = useMemo(() => {
    if (!contact) return "";
    const {
      salutation, first_name, middle_name, last_name, suffix,
      title, email, linkedin_url, phones = [], addresses = [], firm_ids = [],
    } = contact;
    const firmNames = (firm_ids || [])
      .map((id) => firms.find((f) => f.id === id)?.name)
      .filter(Boolean);
    const fullName = [salutation, first_name, middle_name, last_name, suffix].filter(Boolean).join(" ");
    const lines = [];
    if (fullName) lines.push(fullName);
    if (title) lines.push(title);
    if (firmNames.length > 0) lines.push(firmNames.join("; "));
    if (email) lines.push(email);
    (phones || []).forEach((p) => {
      const num = [p.country_code ? `+${p.country_code}` : "", p.area_code, p.number_mid, p.number_last].filter(Boolean).join("-");
      if (num) lines.push(`${p.phone_type ? p.phone_type + ": " : ""}${num}`);
    });
    (addresses || []).forEach((a) => {
      const parts = [a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ");
      if (parts) lines.push(parts);
    });
    if (linkedin_url) lines.push(linkedin_url);
    return lines.join("\n");
  }, [contact, firms]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(vcardText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "vCard copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleCopyInfo = async () => {
    try {
      await navigator.clipboard.writeText(readableInfo);
      setCopiedInfo(true);
      setTimeout(() => setCopiedInfo(false), 2000);
      toast({ title: "Contact info copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!contact) return;
    downloadVCard(contact, firms);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            vCard Preview — {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This is the vCard (VCF) file that will be generated for this contact. It can be
            imported into most contact apps (Apple Contacts, Google Contacts, Outlook, etc.).
          </p>

          {orderedAvailableFields.length > 1 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Field order (drag to reorder)
              </p>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="vcard-field-order">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-1.5">
                      {orderedAvailableFields.map((fieldId, idx) => (
                        <Draggable key={fieldId} draggableId={fieldId} index={idx}>
                          {(prov) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium cursor-grab hover:border-primary/40"
                            >
                              <GripVertical className="w-3 h-3 text-muted-foreground" />
                              {VCARD_FIELD_LABELS[fieldId] || fieldId}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}

          <div className="rounded-lg border border-border bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
              <span className="text-xs font-mono text-gray-400">
                {contact ? `${contact.first_name || ""}_${contact.last_name || ""}`.replace(/^_/, "contact") : "contact"}.vcf
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="text-gray-300 hover:text-white hover:bg-gray-700 h-7">
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="p-4 text-xs font-mono text-green-400 overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
              {vcardText}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" onClick={handleCopyInfo} className="gap-1.5">
            {copiedInfo ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedInfo ? "Copied" : "Copy Contact Info"}
          </Button>
          <Button onClick={handleDownload} className="bg-primary hover:bg-primary/90 text-white">
            <Download className="w-4 h-4 mr-1" /> Download .vcf
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}