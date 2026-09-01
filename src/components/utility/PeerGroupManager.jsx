import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  Plus, Pencil, Trash2, Users, X, Search, ChevronDown, ChevronRight,
  AlertCircle, Loader2, Package,
} from "lucide-react";

export default function PeerGroupManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // peer group being edited (or "new")
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expanded, setExpanded] = useState({});

  const { data: peerGroups = [], isLoading } = useQuery({
    queryKey: ["xponancePeerGroups"],
    queryFn: () => base44.entities.XponancePeerGroup.list("name"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["productsForPeerGroups"],
    queryFn: () => base44.entities.Product.filter(
      { product_type: "Investment Manager Product" },
      "-updated_date",
      500
    ),
  });

  // IM product options for the member picker (exclude soft-deleted)
  const productOptions = useMemo(
    () => products
      .filter((p) => !p.deleted_at)
      .map((p) => ({ id: p.id, name: p.name, firm_name: p.firm_name || "" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["xponancePeerGroups"] });
    queryClient.invalidateQueries({ queryKey: ["productsForPeerGroups"] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.XponancePeerGroup.create(data),
    onSuccess: () => { invalidate(); toast({ title: "Peer group created" }); setEditing(null); },
    onError: (e) => toast({ title: "Failed to create", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => base44.entities.XponancePeerGroup.update(id, patch),
    onSuccess: () => { invalidate(); toast({ title: "Peer group updated" }); setEditing(null); },
    onError: (e) => toast({ title: "Failed to update", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.XponancePeerGroup.delete(id),
    onSuccess: () => { invalidate(); toast({ title: "Peer group deleted" }); setDeleteTarget(null); },
    onError: (e) => toast({ title: "Failed to delete", description: e?.message, variant: "destructive" }),
  });

  // Duplicate-name validation (case-insensitive, excludes the record being edited)
  const isDuplicateName = (name, excludeId) =>
    peerGroups.some((g) => g.name.toLowerCase().trim() === name.toLowerCase().trim() && g.id !== excludeId);

  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-semibold text-gray-700">Xponance Peer Groups</p>
          <Badge variant="outline" className="text-[10px]">{peerGroups.length}</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setEditing({ _isNew: true, name: "", description: "", member_product_ids: [], member_product_names: [] })}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Peer Group
        </Button>
      </div>

      <p className="text-[11px] text-gray-400">
        Define named groups of Investment Manager products for peer comparison during scoring.
        Assign a group to a product from its Classifications tab.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : peerGroups.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-xs text-gray-400 mb-3">No peer groups yet.</p>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setEditing({ _isNew: true, name: "", description: "", member_product_ids: [], member_product_names: [] })}
          >
            <Plus className="w-3.5 h-3.5" />
            Create your first peer group
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {peerGroups.map((g) => {
            const isOpen = !!expanded[g.id];
            const memberCount = (g.member_product_ids || []).length;
            return (
              <div key={g.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => toggleExpand(g.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                    <span className="font-medium text-sm text-gray-800 truncate">{g.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{memberCount} member{memberCount === 1 ? "" : "s"}</Badge>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...g })}
                      className="p-1.5 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(g)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-3 py-2 border-t bg-gray-50/50">
                    {g.description && (
                      <p className="text-xs text-gray-500 mb-2">{g.description}</p>
                    )}
                    <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Members</div>
                    {memberCount === 0 ? (
                      <p className="text-xs text-gray-400 italic">No members assigned yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(g.member_product_names || []).map((name, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px]">
                            <Package className="w-3 h-3" />
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create dialog */}
      {editing && (
        <PeerGroupEditDialog
          group={editing}
          productOptions={productOptions}
          isDuplicateName={isDuplicateName}
          onSave={(data) => {
            if (editing._isNew) {
              createMutation.mutate(data);
            } else {
              updateMutation.mutate({ id: editing.id, patch: data });
            }
          }}
          onClose={() => setEditing(null)}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Delete peer group?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold">"{deleteTarget.name}"</span>? Products assigned to this group will have their peer group cleared. This cannot be undone.
            </p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PeerGroupEditDialog({ group, productOptions, isDuplicateName, onSave, onClose, saving }) {
  const [name, setName] = useState(group.name || "");
  const [description, setDescription] = useState(group.description || "");
  const [memberIds, setMemberIds] = useState(group.member_product_ids || []);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const nameTrim = name.trim();
  const isDup = nameTrim.length > 0 && isDuplicateName(nameTrim, group._isNew ? null : group.id);
  const canSave = nameTrim.length > 0 && !isDup && !saving;

  const toggleMember = (id) => {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const removeMember = (id) => setMemberIds((prev) => prev.filter((x) => x !== id));

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = productOptions.filter((p) => !memberIds.includes(p.id));
    if (!q) return base;
    return base.filter((p) => `${p.name} ${p.firm_name}`.toLowerCase().includes(q));
  }, [productOptions, memberIds, search]);

  const memberNames = useMemo(() => {
    const map = new Map(productOptions.map((p) => [p.id, p.name]));
    return memberIds.map((id) => map.get(id) || id);
  }, [memberIds, productOptions]);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: nameTrim,
      description: description.trim(),
      member_product_ids: memberIds,
      member_product_names: memberNames,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{group._isNew ? "Create Peer Group" : "Edit Peer Group"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. US Large Cap Growth Peers"
              autoFocus
              className={isDup ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {isDup && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                A peer group with this name already exists.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What criteria define this peer group?"
              className="min-h-[60px] text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">
                Members ({memberIds.length})
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-indigo-600"
                onClick={() => setShowPicker((o) => !o)}
              >
                <Plus className="w-3.5 h-3.5" />
                Add products
              </Button>
            </div>

            {showPicker && (
              <div className="border border-gray-200 rounded-lg p-2 bg-white space-y-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products…"
                    className="flex-1 text-xs outline-none bg-transparent"
                  />
                </div>
                <div className="max-h-44 overflow-auto space-y-0.5">
                  {filteredOptions.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">No products to add.</p>
                  ) : (
                    filteredOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleMember(p.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs rounded hover:bg-indigo-50"
                      >
                        <span className="w-3.5 h-3.5 rounded border border-gray-300 flex items-center justify-center shrink-0">
                        </span>
                        <span className="truncate">
                          <span className="font-medium">{p.name}</span>
                          {p.firm_name && <span className="text-gray-400"> — {p.firm_name}</span>}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {memberIds.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No members selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {memberIds.map((id) => {
                  const p = productOptions.find((x) => x.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px]">
                      <Package className="w-3 h-3" />
                      {p?.name || id}
                      <button type="button" onClick={() => removeMember(id)} className="hover:text-indigo-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : group._isNew ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}