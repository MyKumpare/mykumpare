import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { User, Loader2, Images } from "lucide-react";
import ImageZoomDialog from "../common/ImageZoomDialog";

function formatContactName(c) {
  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
  return c.designations?.length ? `${name}, ${c.designations.join(", ")}` : name;
}

export default function FirmContactPhotoGallery({ firmId, onContactClick }) {
  const [zoomPhoto, setZoomPhoto] = useState(null);

  const { data: contacts = [], isFetching } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const firmContacts = useMemo(
    () => contacts
      .filter((c) => c.firm_ids?.includes(firmId) && !c.deleted_at)
      .sort((a, b) => {
        const aActive = (a.contact_status || "Active") === "Active" ? 0 : 1;
        const bActive = (b.contact_status || "Active") === "Active" ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return (a.first_name || "").localeCompare(b.first_name || "") || (a.last_name || "").localeCompare(b.last_name || "");
      }),
    [contacts, firmId]
  );

  const withPhotos = firmContacts.filter((c) => c.photo_url);
  const withoutPhotos = firmContacts.filter((c) => !c.photo_url);

  if (isFetching && firmContacts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (firmContacts.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
        No contacts added yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
          <Images className="w-3 h-3" />
          {firmContacts.length} contact{firmContacts.length !== 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 font-medium">
          {withPhotos.length} with photo{withPhotos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {firmContacts.map((contact) => {
          const isActive = (contact.contact_status || "Active") === "Active";
          const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join("").toUpperCase();
          return (
            <div
              key={contact.id}
              className="group flex flex-col items-center text-center cursor-pointer"
              onClick={() => onContactClick?.(contact)}
            >
              <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 transition-all group-hover:border-indigo-300 group-hover:shadow-md">
                {contact.photo_url ? (
                  <img
                    src={contact.photo_url}
                    alt={formatContactName(contact)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-300">
                    {initials ? (
                      <span className="text-2xl font-semibold">{initials}</span>
                    ) : (
                      <User className="w-10 h-10" />
                    )}
                  </div>
                )}
                {!isActive && (
                  <div className="absolute inset-0 bg-gray-500/30 flex items-center justify-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white bg-gray-700/70 px-1.5 py-0.5 rounded">
                      Inactive
                    </span>
                  </div>
                )}
                {contact.photo_url && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 p-1 rounded-md bg-white/80 text-gray-600 hover:text-indigo-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomPhoto({ url: contact.photo_url, name: formatContactName(contact), title: contact.title });
                    }}
                    title="View full photo"
                  >
                    <Images className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 w-full px-1">
                <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 truncate leading-tight">
                  {formatContactName(contact)}
                </p>
                {contact.title && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{contact.title}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ImageZoomDialog
        open={!!zoomPhoto}
        onOpenChange={(v) => { if (!v) setZoomPhoto(null); }}
        src={zoomPhoto?.url}
        alt={zoomPhoto?.name || "Contact photo"}
        caption={zoomPhoto?.title ? `${zoomPhoto.name} — ${zoomPhoto.title}` : zoomPhoto?.name}
      />
    </div>
  );
}