import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, User } from "lucide-react";
import AddContactDialog from "./AddContactDialog";

export default function ContactsTab({ firmId, firms = [] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [viewMode, setViewMode] = useState(false);

  const queryClient = useQueryClient();

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date"),
  });

  const firmContacts = contacts.filter((c) => c.firm_ids?.includes(firmId));

  const handleView = (contact) => {
    setEditingContact(contact);
    setViewMode(true);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    setViewMode(false);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={handleAdd}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Contact
        </Button>
      </div>

      {firmContacts.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          No contacts added
        </div>
      ) : (
        <div className="space-y-2">
          {firmContacts
            .sort((a, b) => a.last_name.localeCompare(b.last_name))
            .map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer"
                onClick={() => handleView(contact)}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {contact.photo_url ? (
                    <img src={contact.photo_url} alt={contact.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-indigo-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-indigo-700 hover:underline">
                    {contact.first_name} {contact.last_name}
                  </div>
                  {contact.title && (
                    <div className="text-xs text-gray-500">{contact.title}</div>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-xs text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>{contact.email}</a>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      <AddContactDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setViewMode(false); }}
        editingContact={editingContact}
        currentFirmId={firmId}
        firms={firms}
        viewMode={viewMode}
      />
    </div>
  );
}