import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import QuestionnaireDialog from "@/components/questionnaires/QuestionnaireDialog";
import ExternalProductSubmission from "@/components/external/ExternalProductSubmission";
import {
  ClipboardList, Clock, Building2, Calendar, CheckCircle2, Play, LogOut,
  MapPin, Phone, Globe, Users, Package, FileText, Plus, Trash2, Mail, Loader2,
  ExternalLink, ShieldCheck, Crown, UserPlus, X, ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Submitted: "bg-purple-50 text-purple-700 border-purple-200",
  "Under Review": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const calcProgress = (item) => {
  if (!item.sections) return { total: 0, completed: 0, inProgress: 0, pct: 0 };
  let total = 0, completed = 0, inProgress = 0;
  item.sections.forEach((s) => {
    (s.sub_sections || []).forEach((ss) => {
      total++;
      if (ss.status === "completed") completed++;
      if (ss.status === "in_progress") inProgress++;
    });
  });
  return { total, completed, inProgress, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
};

const TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "products", label: "Products", icon: Package },
  { id: "questionnaires", label: "Questionnaires", icon: ClipboardList },
  { id: "users", label: "Users", icon: Users },
];

export default function ExternalParty() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Determine firm ID and access mode
  const urlFirmId = searchParams.get("firmId");
  const isExternalUser = !!(user?.is_external_party || (!urlFirmId && user?.linked_firm_id));
  const firmId = urlFirmId || user?.linked_firm_id;
  const readOnly = !!urlFirmId && !isExternalUser;

  // Load firm data
  const { data: firm, isLoading: firmLoading } = useQuery({
    queryKey: ["external_firm", firmId],
    queryFn: () => base44.entities.Firm.get(firmId),
    enabled: !!firmId,
  });

  // Load contacts for this firm
  const { data: allContacts = [] } = useQuery({
    queryKey: ["external_firm_contacts", firmId],
    queryFn: () => base44.entities.Contact.list("-created_date", 500),
    enabled: !!firmId,
  });
  const firmContacts = useMemo(
    () => allContacts.filter((c) => !c.deleted_at && (c.firm_ids || []).includes(firmId)),
    [allContacts, firmId]
  );

  // Load questionnaires
  const contactId = user?.linked_contact_id;
  const { data: questionnaires = [], isLoading: qLoading } = useQuery({
    queryKey: ["external_party_questionnaires", contactId],
    queryFn: () => base44.entities.Questionnaire.filter({ assignee_contact_id: contactId }, "-created_date", 500),
    enabled: !!contactId && isExternalUser,
  });

  // Load pending invitations for this firm
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["external_firm_invites", firmId],
    queryFn: () => base44.entities.PendingInvitation.filter({ firm_id: firmId }, "-created_date", 200),
    enabled: !!firmId,
  });

  const active = questionnaires.filter((q) => q.status !== "Completed");
  const completed = questionnaires.filter((q) => q.status === "Completed");

  const firmTypes = useMemo(() => {
    if (!firm) return [];
    return firm.firm_types?.length ? firm.firm_types : (firm.firm_type ? [firm.firm_type] : []);
  }, [firm]);

  const hq = firm?.addresses?.find((a) => a.is_headquarters) || firm?.addresses?.[0];
  const defaultPhone = firm?.phones?.find((p) => p.is_default) || firm?.phones?.[0];

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Breadcrumb bar */}
      {!isExternalUser && (
        <div className="bg-gray-100 border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 text-xs text-gray-500">
            <button onClick={() => navigate("/")} className="hover:text-indigo-600 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Dashboard
            </button>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <button onClick={() => navigate(-1)} className="hover:text-indigo-600">
              External Portals
            </button>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-700 font-medium truncate">{firm?.name || "Portal"}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {firm?.logo_url ? (
              <img src={firm.logo_url} alt="" className="w-10 h-10 rounded-lg bg-white object-contain p-0.5 border border-white/30" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold leading-tight">{firm?.name || "External Portal"}</h1>
              <p className="text-[11px] text-white/60 leading-tight">
                {firmTypes.join(", ") || "External Firm Portal"}
                {readOnly && " · View Only"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {urlFirmId && !isExternalUser && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-white/80 hover:text-white hover:bg-white/10" onClick={() => navigate(-1)}>
                <X className="w-3.5 h-3.5" /> Close Portal
              </Button>
            )}
            {isExternalUser && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-white/80 hover:text-white hover:bg-white/10" onClick={() => logout()}>
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === id
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
              {id === "questionnaires" && active.length > 0 && (
                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded-full">{active.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {firmLoading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : !firm ? (
          <div className="text-center py-12 text-sm text-gray-400">Firm not found.</div>
        ) : (
          <>
            {/* ── Overview Tab ── */}
            {tab === "overview" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start gap-4">
                    {firm.logo_url ? (
                      <img src={firm.logo_url} alt="" className="w-16 h-16 rounded-xl bg-gray-50 object-contain p-1 border border-gray-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-indigo-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-bold text-gray-800">{firm.name}</h2>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {firmTypes.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                      {firm.website && (
                        <a href={firm.website} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-500 hover:underline flex items-center gap-0.5 mt-1">
                          <Globe className="w-3 h-3" /> {firm.website}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Addresses
                  </h3>
                  {firm.addresses?.length ? (
                    <div className="space-y-2">
                      {firm.addresses.map((addr) => (
                        <div key={addr.id} className="text-xs text-gray-600 p-2 rounded-lg bg-gray-50">
                          {addr.is_headquarters && <Badge className="text-[9px] mb-1 bg-indigo-50 text-indigo-700">HQ</Badge>}
                          {addr.address_line1 && <p>{addr.address_line1}</p>}
                          {addr.address_line2 && <p>{addr.address_line2}</p>}
                          <p>{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}</p>
                          {addr.country && <p>{addr.country}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No addresses on file.</p>
                  )}
                </div>

                {/* Phones */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-500" /> Phone Numbers
                  </h3>
                  {firm.phones?.length ? (
                    <div className="space-y-1.5">
                      {firm.phones.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{p.phone_type || "Phone"}</span>
                          <a href={`tel:+${p.country_code}${p.area_code}${p.number_mid}${p.number_last}`} className="text-indigo-600 hover:underline">
                            +{p.country_code} ({p.area_code}) {p.number_mid}-{p.number_last}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No phone numbers on file.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Products Tab ── */}
            {tab === "products" && (
              <ExternalProductSubmission
                firmId={firmId}
                firmName={firm.name}
                firmTypes={firmTypes}
                contactId={contactId}
                contactName={user?.full_name}
                readOnly={readOnly}
              />
            )}

            {/* ── Questionnaires Tab ── */}
            {tab === "questionnaires" && (
              <div className="space-y-4">
                {!isExternalUser ? (
                  <div className="text-center py-8 text-sm text-gray-400">
                    Questionnaires are only visible to the assigned external party contact.
                  </div>
                ) : qLoading ? (
                  <div className="py-8 text-center">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                  </div>
                ) : questionnaires.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                    <ClipboardList className="w-10 h-10 text-gray-300 mx-auto" />
                    <p className="text-sm font-medium text-gray-700 mt-2">No questionnaires assigned</p>
                    <p className="text-xs text-gray-400 mt-1">You'll be notified when a new questionnaire is sent.</p>
                  </div>
                ) : (
                  <>
                    {active.length > 0 && (
                      <div className="space-y-2">
                        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 text-indigo-500" /> Active ({active.length})
                        </h2>
                        {active.map((item) => {
                          const prog = calcProgress(item);
                          return (
                            <div key={item.id} onClick={() => setSelected(item)}
                              className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-colors bg-white">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-800 truncate">{item.name || "Untitled"}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{item.template_name}</p>
                                </div>
                                <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${STATUS_STYLES[item.status] || ""}`}>{item.status}</Badge>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
                                {item.due_date && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> Due: {fmtDate(item.due_date)}</span>}
                              </div>
                              {prog.total > 0 && (
                                <div className="space-y-0.5">
                                  <Progress value={prog.pct} className="h-1.5" />
                                  <div className="text-right text-[9px] text-gray-400">{prog.completed}/{prog.total} sections completed ({prog.pct}%)</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {completed.length > 0 && (
                      <div className="space-y-2">
                        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Completed ({completed.length})
                        </h2>
                        {completed.map((item) => (
                          <div key={item.id} onClick={() => setSelected(item)}
                            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors bg-white opacity-75">
                            <p className="text-sm font-medium text-gray-700 truncate">{item.name || "Untitled"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Users Tab ── */}
            {tab === "users" && (
              <div className="space-y-4">
                {readOnly ? (
                  <div className="text-center py-8 text-sm text-gray-400">
                    User management is only available to external firm administrators.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-500" /> Firm Users
                      </h2>
                      <Button size="sm" className="h-8 text-xs" onClick={() => setInviteOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Invite User
                      </Button>
                    </div>

                    {/* Contacts list */}
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <h3 className="text-xs font-semibold text-gray-600">Team Members ({firmContacts.length})</h3>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {firmContacts.map((c) => (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                              {(c.first_name?.[0] || "?").toUpperCase()}{(c.last_name?.[0] || "").toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {[c.salutation, c.first_name, c.last_name].filter(Boolean).join(" ")}
                              </p>
                              <p className="text-[11px] text-gray-500 flex items-center gap-0.5 truncate">
                                <Mail className="w-2.5 h-2.5" /> {c.email || "—"}
                              </p>
                            </div>
                            {c.contact_status === "Active" ? (
                              <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                            ) : (
                              <Badge className="text-[9px] bg-gray-50 text-gray-500 border-gray-200">Inactive</Badge>
                            )}
                          </div>
                        ))}
                        {firmContacts.length === 0 && (
                          <div className="p-6 text-center text-sm text-gray-400">No team members yet.</div>
                        )}
                      </div>
                    </div>

                    {/* Pending invitations */}
                    {pendingInvites.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-600">Pending Invitations ({pendingInvites.filter(i => !i.accepted).length})</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {pendingInvites.filter(i => !i.accepted).map((inv) => (
                            <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800 truncate">{inv.email}</p>
                                <p className="text-[11px] text-gray-500">
                                  {[inv.first_name, inv.last_name].filter(Boolean).join(" ") || ""}
                                  {inv.firm_role === "admin" && " · Firm Admin"}
                                </p>
                              </div>
                              <Badge className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Questionnaire dialog */}
      {selected && (
        <QuestionnaireDialog
          open={!!selected}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          editQuestionnaire={selected}
          user={user}
          firms={firm ? [firm] : []}
          contacts={firmContacts}
          products={[]}
          isExternalParty={true}
        />
      )}

      {/* Invite user dialog */}
      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        firmId={firmId}
        firmName={firm?.name}
        user={user}
        onInvited={() => {
          queryClient.invalidateQueries({ queryKey: ["external_firm_invites", firmId] });
          queryClient.invalidateQueries({ queryKey: ["external_firm_contacts", firmId] });
        }}
      />
    </div>
  );
}

// ── Invite User Modal (for external firm admins) ──
function InviteUserModal({ open, onClose, firmId, firmName, user, onInvited }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await base44.users.inviteUser(form.email.trim().toLowerCase(), "user");
      await base44.entities.PendingInvitation.create({
        email: form.email.trim().toLowerCase(),
        firm_id: firmId,
        firm_name: firmName,
        firm_role: "user",
        can_edit: true,
        can_delete: false,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        contact_name: `${form.first_name} ${form.last_name}`.trim(),
        invited_by_name: user?.full_name || user?.email,
        accepted: false,
        invitation_type: "external_party",
      });
      // Send automated invitation email via Outlook
      try {
        const regUrl = `${window.location.origin}/#/register`;
        await base44.functions.invoke("sendExternalInvitationEmail", {
          email: form.email.trim().toLowerCase(),
          inviteeName: `${form.first_name} ${form.last_name}`.trim(),
          firmName,
          invitedByName: user?.full_name || user?.email,
          registrationUrl: regUrl,
        });
      } catch (emailErr) {
        console.warn("Invitation email failed:", emailErr);
      }
      toast({ title: "Invitation sent", description: `${form.email} has been invited to ${firmName}.` });
      setForm({ email: "", first_name: "", last_name: "" });
      onInvited();
      onClose();
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("exist") || msg.includes("registered") || msg.includes("invited")) {
        toast({ title: "User already invited", description: `${form.email} has already been invited.`, variant: "destructive" });
      } else {
        toast({ title: "Invitation failed", description: err?.message, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <UserPlus className="w-4 h-4 text-indigo-500" /> Invite Team Member
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">First Name *</Label>
              <Input className="h-9 mt-1" value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} required />
            </div>
            <div>
              <Label className="text-xs">Last Name *</Label>
              <Input className="h-9 mt-1" value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} required />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input className="h-9 mt-1" type="email" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Send Invite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}