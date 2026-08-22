import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Loader2 } from "lucide-react";

// Management dialog for the investment team role library. Users can add new
// predefined roles and remove ones no longer needed. Roles removed from the
// library are simply no longer offered in the picker — existing assignments on
// products are stored as plain strings and are not affected.
export default function InvestmentTeamRoleManager({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [newRole, setNewRole] = useState("");

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["investment-team-roles"],
    queryFn: () => base44.entities.InvestmentTeamRole.list("name", 500),
  });

  const createRole = useMutation({
    mutationFn: (name) => base44.entities.InvestmentTeamRole.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-team-roles"] });
      setNewRole("");
    },
  });

  const deleteRole = useMutation({
    mutationFn: (id) => base44.entities.InvestmentTeamRole.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["investment-team-roles"] }),
  });

  const handleAdd = () => {
    const v = newRole.trim();
    if (!v) return;
    if (roles.some((r) => r.name.toLowerCase() === v.toLowerCase())) {
      setNewRole("");
      return;
    }
    createRole.mutate(v);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Investment Team Roles</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="New role name (e.g. Lead Analyst)…"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newRole.trim() || createRole.isPending}
            className="gap-1 flex-shrink-0"
          >
            {createRole.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </div>

        <div className="border rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
          {isLoading ? (
            <div className="px-3 py-6 text-xs text-gray-400 text-center">Loading…</div>
          ) : roles.length === 0 ? (
            <div className="px-3 py-6 text-xs text-gray-400 text-center">No roles in the library yet</div>
          ) : (
            roles.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-700">{r.name}</span>
                <button
                  type="button"
                  title="Remove from library"
                  onClick={() => deleteRole.mutate(r.id)}
                  disabled={deleteRole.isPending}
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