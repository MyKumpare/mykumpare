import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck, Crown, UserPlus, ArrowLeft, Mail, Lock, ShieldAlert, Users as UsersIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import InviteUserDialog from "@/components/admin/InviteUserDialog";

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
}

export default function UserManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyOwnerId, setBusyOwnerId] = useState(null);

  const isAdmin = user?.role === "admin";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list("-created_date"),
    enabled: isAdmin,
  });
  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: isAdmin,
  });

  const owner = users.find((u) => u.is_owner);
  const adminCount = users.filter((u) => u.role === "admin").length;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (e) => toast({ title: "Update failed", description: e?.message || "Could not update user.", variant: "destructive" }),
  });

  const handleRoleChange = (u, newRole) => {
    if (u.id === user?.id && newRole !== "admin") {
      toast({ title: "Not allowed", description: "You can't remove your own administrator access.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: u.id, data: { role: newRole } });
  };

  const handleMakeOwner = async (u) => {
    if (u.is_owner) return;
    if (!window.confirm(`Make ${u.full_name || u.email} the application owner? They will be granted administrator access.`)) return;
    setBusyOwnerId(u.id);
    try {
      if (owner && owner.id !== u.id) {
        await base44.entities.User.update(owner.id, { is_owner: false });
      }
      await base44.entities.User.update(u.id, { is_owner: true, role: "admin" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Owner updated", description: `${u.full_name || u.email} is now the application owner.` });
    } catch (e) {
      toast({ title: "Failed to set owner", description: e?.message, variant: "destructive" });
    } finally {
      setBusyOwnerId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm w-full rounded-2xl border border-gray-200 bg-white p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-rose-500" />
          </div>
          <h1 className="text-base font-bold text-gray-800">Administrators only</h1>
          <p className="text-sm text-gray-500">You need an administrator role to access user &amp; role management.</p>
          <Link to="/">
            <Button variant="outline" size="sm" className="h-8 text-xs mt-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to app
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const firmName = (u) => firms.find((f) => f.id === u.linked_firm_id)?.name;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">User &amp; Role Management</h1>
              <p className="text-[11px] text-white/60 leading-tight">Owner, administrators &amp; user access</p>
            </div>
          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              className="h-8 text-xs bg-white text-indigo-700 hover:bg-white/90"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite User
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500"><UsersIcon className="w-3.5 h-3.5" /> Total users</div>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{users.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500"><ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Administrators</div>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{adminCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500"><Crown className="w-3.5 h-3.5 text-amber-500" /> Owner</div>
            <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{owner ? (owner.full_name || owner.email) : "Not set"}</p>
          </div>
        </div>

        {/* Owner callout */}
        {!owner && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>No application owner is designated yet. Use “Make Owner” on a user to assign the top-level administrator.</span>
          </div>
        )}

        {/* Users table */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Users</h2>
            <span className="text-[11px] text-gray-400">{users.length} {users.length === 1 ? "user" : "users"}</span>
          </div>
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading users…</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-gray-50/60">
                    {/* Identity */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                        {(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name || "(no name)"}</p>
                          {u.is_owner && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              <Crown className="w-2.5 h-2.5" /> Owner
                            </span>
                          )}
                          {isSelf && <span className="text-[10px] text-gray-400">(you)</span>}
                        </div>
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {u.email}</p>
                        {firmName(u) && <p className="text-[11px] text-gray-400 truncate">Linked firm: {firmName(u)}</p>}
                      </div>
                    </div>

                    {/* Role */}
                    <div className="flex items-center gap-2 sm:justify-end">
                      <Select
                        value={u.role || "user"}
                        onValueChange={(v) => handleRoleChange(u, v)}
                        disabled={isSelf || updateMutation.isPending}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                      {!u.is_owner && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={busyOwnerId === u.id}
                          onClick={() => handleMakeOwner(u)}
                        >
                          <Crown className="w-3 h-3 text-amber-500" /> Make Owner
                        </Button>
                      )}
                    </div>

                    <div className="hidden md:block text-[11px] text-gray-400 w-28 text-right">{fmtDate(u.created_date)}</div>
                  </div>
                );
              })}
              {users.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-400">No users found.</div>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Roles control access: <span className="font-medium text-gray-600">Administrators</span> can manage all data and invite/manage users;
          <span className="font-medium text-gray-600"> Users</span> have standard access to firms, contacts, products and activities.
          The <span className="font-medium text-gray-600">Owner</span> is the top-level administrator of this application.
        </p>
      </div>

      <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={() => queryClient.invalidateQueries({ queryKey: ["users"] })} />
    </div>
  );
}