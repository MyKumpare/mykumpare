import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Loader2 } from "lucide-react";

// Management dialog for the contact tag library. Users can add new predefined
// tags and remove ones no longer needed. Tags removed from the library are
// simply no longer offered in the picker — existing assignments on contacts
// are stored as plain strings and are not affected.
export default function ContactTagManager({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState("");

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["contact-tags"],
    queryFn: () => base44.entities.ContactTag.list("name", 500),
  });

  const createTag = useMutation({
    mutationFn: (name) => base44.entities.ContactTag.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      setNewTag("");
    },
  });

  const deleteTag = useMutation({
    mutationFn: (id) => base44.entities.ContactTag.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-tags"] }),
  });

  const handleAdd = () => {
    const v = newTag.trim();
    if (!v) return;
    if (tags.some((t) => t.name.toLowerCase() === v.toLowerCase())) {
      setNewTag("");
      return;
    }
    createTag.mutate(v);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Contact Tags</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="New tag name (e.g. Investor)…"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newTag.trim() || createTag.isPending}
            className="gap-1 flex-shrink-0"
          >
            {createTag.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </div>

        <div className="border rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
          {isLoading ? (
            <div className="px-3 py-6 text-xs text-gray-400 text-center">Loading…</div>
          ) : tags.length === 0 ? (
            <div className="px-3 py-6 text-xs text-gray-400 text-center">No tags in the library yet</div>
          ) : (
            tags.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-700">{t.name}</span>
                <button
                  type="button"
                  title="Remove from library"
                  onClick={() => deleteTag.mutate(t.id)}
                  disabled={deleteTag.isPending}
                  className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}