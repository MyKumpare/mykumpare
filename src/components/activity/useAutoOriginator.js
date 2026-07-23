import { useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Resolves the signed-in user's Contact record from a provided contact list
// by matching the authenticated user's email (case-insensitive). Returns null
// if not logged in or no matching contact is found.
export async function getCurrentUserContact(contacts) {
  try {
    const user = await base44.auth.me();
    const email = (user?.email || "").toLowerCase();
    if (!email || !contacts?.length) return null;
    return contacts.find((c) => !c.deleted_at && (c.email || "").toLowerCase() === email) || null;
  } catch {
    return null;
  }
}

// Auto-populates the originator (contact + firm) from the signed-in user.
// Prefers the explicitly-linked contact/firm (set from the profile dialog),
// then falls back to matching the user's email to a Contact record. The
// resulting originator stays fully editable by the user. No-op if a contact
// is already selected or no match exists.
export function useAutoOriginator(allFirms, allContacts, setOriginator, originator) {
  useEffect(() => {
    if (originator.contactId) return;
    if (!allContacts.length || !allFirms.length) return;
    let active = true;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!active) return;

        // 1) Prefer the explicitly-linked contact record (from profile dialog).
        let contact = null;
        let preferredFirmId = "";
        if (user?.linked_contact_id) {
          contact = allContacts.find(
            (c) => c.id === user.linked_contact_id && !c.deleted_at
          ) || null;
          if (contact) preferredFirmId = user.linked_firm_id || "";
        }

        // 2) Fall back to an email match if no linked contact resolved.
        if (!contact) {
          const email = (user?.email || "").toLowerCase();
          if (email) {
            contact = allContacts.find(
              (c) => !c.deleted_at && (c.email || "").toLowerCase() === email
            ) || null;
          }
        }

        if (!contact) return;

        // Resolve the associated firm: prefer the linked firm (if the contact
        // belongs to it), otherwise the contact's first firm.
        let firmId = "";
        if (preferredFirmId && (contact.firm_ids || []).includes(preferredFirmId)) {
          firmId = preferredFirmId;
        }
        if (!firmId) firmId = (contact.firm_ids || [])[0] || "";

        const firm = firmId ? allFirms.find((f) => f.id === firmId) : null;
        if (!active) return;
        setOriginator({
          firmId,
          firmName: firm?.name || "",
          firmType: null,
          contactId: contact.id,
          contactName: [contact.first_name, contact.last_name]
            .filter(Boolean)
            .join(" "),
        });
      } catch {
        // not logged in or lookup failed — leave manual selection
      }
    })();
    return () => {
      active = false;
    };
  }, [allContacts, allFirms, originator.contactId, setOriginator]);
}