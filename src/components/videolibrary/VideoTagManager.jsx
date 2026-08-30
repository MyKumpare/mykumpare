import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, X, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * VideoTagManager — CRUD + reorder for VideoTag records.
 * Validates no duplicate tag names (case-insensitive, trimmed).
 *
 * Props:
 *   open — boolean
 *   onClose — () => void
 */
export default function VideoTagManager({ open, onClose }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["video_tags"],
    queryFn: () => base44.entities.VideoTag.list("-created_date", 500),
  });

  const sorted = [...tags].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const isDuplicate = (name, excludeId = null) => {
    const trimmed = name.trim().toLowerCase();
    return tags.some((t) => t.name.trim().toLowerCase() === trimmed && t.id !== excludeId);
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VideoTag.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_tags"] });
      setNewName("");
      setError("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VideoTag.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_tags"] });
      setEditingId(null);
      setEditName("");
      setError("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VideoTag.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video_tags"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VideoTag.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video_tags"] }),
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (isDuplicate(newName)) {
      setError(`A tag named "${newName.trim()}" already exists.`);
      return;
    }
    const maxOrder = sorted.length > 0 ? Math.max(...sorted.map((t) => t.sort_order || 0)) : 0;
    createMutation.mutate({ name: newName.trim(), sort_order: maxOrder + 1 });
  };

  const handleEdit = (tag) => {
    if (!editName.trim()) return;
    if (isDuplicate(editName, tag.id)) {
      setError(`A tag named "${editName.trim()}" already exists.`);
      return;
    }
    updateMutation.mutate({ id: tag.id, data: { name: editName.trim() } });
  };

  const handleMove = (tag, direction) => {
    const idx = sorted.findIndex((t) => t.id === tag.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapTag = sorted[swapIdx];
    const tagOrder = tag.sort_order || idx;
    const swapOrder = swapTag.sort_order || swapIdx;
    reorderMutation.mutate({ id: tag.id, data: { sort_order: swapOrder } });
    reorderMutation.mutate({ id: swapTag.id, data: { sort_order: tagOrder } });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">Manage Video Tags</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add new tag */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="New tag name..."
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} className="h-8">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          {error && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {error}
            </p>
          )}
        </div>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <p className="text-xs text-gray-400 text-center py-4">Loading tags...</p>
          ) : sorted.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No tags yet. Add one above.</p>
          ) : (
            <div className="space-y-1">
              {sorted.map((tag, idx) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 group"
                >
                  {editingId === tag.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleEdit(tag)}
                        className="h-7 text-sm flex-1"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleEdit(tag)} className="h-7 px-2">Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditName(""); setError(""); }} className="h-7 px-2">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color || "#6366f1" }}
                      />
                      <span className="text-sm text-gray-700 flex-1">{tag.name}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMove(tag, "up")}
                          disabled={idx === 0}
                          className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(tag, "down")}
                          disabled={idx === sorted.length - 1}
                          className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditingId(tag.id); setEditName(tag.name); }}
                          className="p-1 text-gray-400 hover:text-indigo-600"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(tag.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}