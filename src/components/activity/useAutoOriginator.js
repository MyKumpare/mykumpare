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

// Auto-populates the originator (contact + firm) from the signed-in user's email.
// Looks up a Contact whose email matches the logged-in user's email and resolves
// the associated firm. No-op if a contact is already selected or no match exists.
export function useAutoOriginator(allFirms, allContacts, setOriginator, originator) {
  useEffect(() => {
    if (originator.contactId) return;
    if (!allContacts.length || !allFirms.length) return;
    let active = true;
    (async () => {
      try {
        const user = await base44.auth.me();
        const email = (user?.email || "").toLowerCase();
        if (!email) return;
        const contact = allContacts.find(
          (c) => !c.deleted_at && (c.email || "").toLowerCase() === email
        );
        if (!contact) return;
        const firmId = (contact.firm_ids || [])[0] || "";
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