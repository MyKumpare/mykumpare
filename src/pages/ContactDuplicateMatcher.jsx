import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Loader2, Mail, Users, Merge, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, User, Zap,
} from "lucide-react";
import {
  findNameEmailDuplicates, normalizeEmail, normalizeContactName, contactDisplayName,
} from "@/components/contacts/contactNameEmailMatch";

const MATCH_CONFIG = {
  exact: {
    label: "Exact Match (Same Name + Email)",
    description: "Contacts with identical names and email addresses — safe to auto-merge.",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    autoMerge: true,
  },
  same_email: {
    label: "Same Email, Different Name",
    description: "Contacts sharing an email — likely the same person with a name variant.",
    icon: Mail,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    autoMerge: false,
  },
  same_name: {
    label: "Same Name, Different Email",
    description: "Contacts with the same name but different emails — review before merging.",
    icon: Users,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    autoMerge: false,
  },
};

function ContactMiniCard({ contact, isPrimary }) {
  const photo = contact.photo_url;
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border ${isPrimary ? "border-emerald-300 bg-emerald-50/50" : "border-gray-200 bg-white"}`}>
      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
        {photo ? (
          <img src={photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <User className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-medium text-gray-800 truncate">
          {contactDisplayName(contact)}
          {isPrimary && <span className="ml-1 text-emerald-600">★</span>}
        </p>
        <p className="text-gray-500 truncate">{contact.email || "—"}</p>
        <p className="text-gray-400 truncate">{contact.title || "—"}</p>
        <p className="text-gray-400 truncate">
          {(contact.firm_ids || []).length} firm{(contact.firm_ids || []).length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

function DuplicateGroup({ group, onMerge, merging }) {
  const [expanded, setExpanded] = useState(true);
  const config = MATCH_CONFIG[group.matchType];
  const Icon = config.icon;

  // Pick the most complete record as merge target
  const completeness = (c) =>
    [c.first_name, c.last_name, c.email, c.title, c.photo_url, c.biography,
     ...(c.firm_ids || []), ...(c.phones || [])]
      .filter(Boolean).length;
  const primary = [...group.contacts].sort((a, b) => completeness(b) - completeness(a))[0];

  return (
    <Card className={`border ${config.border} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <Icon className={`w-4 h-4 ${config.color} flex-shrink-0`} />
          <span className="text-sm font-medium text-gray-800 truncate">
            {group.matchType === "exact" && `${group.contacts[0].email}`}
            {group.matchType === "same_email" && normalizeEmail(group.contacts[0].email)}
            {group.matchType === "same_name" && normalizeContactName(group.contacts[0])}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${config.badge} flex-shrink-0`}>
            {group.contacts.length} contacts
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs flex-shrink-0"
          disabled={merging}
          onClick={(e) => { e.stopPropagation(); onMerge(group, primary); }}
        >
          {merging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
          Merge into best
        </Button>
      </button>
      {expanded && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {group.contacts.map((c) => (
            <ContactMiniCard key={c.id} contact={c} isPrimary={c.id === primary.id} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ContactDuplicateMatcher() {
  const queryClient = useQueryClient();
  const [scanned, setScanned] = useState(false);
  const [autoMerging, setAutoMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [mergingGroupKey, setMergingGroupKey] = useState(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const duplicates = useMemo(() => {
    if (!scanned) return { exact: [], sameEmail: [], sameName: [] };
    return findNameEmailDuplicates(contacts);
  }, [contacts, scanned]);

  const totalGroups = duplicates.exact.length + duplicates.sameEmail.length + duplicates.sameName.length;
  const totalContacts = [
    ...duplicates.exact, ...duplicates.sameEmail, ...duplicates.sameName,
  ].reduce((sum, g) => sum + g.contacts.length, 0);

  const handleMergeGroup = async (group, primary) => {
    setMergingGroupKey(group.key);
    const secondaries = group.contacts.filter((c) => c.id !== primary.id);
    let merged = 0;
    const errors = [];
    for (const sec of secondaries) {
      try {
        const res = await base44.functions.invoke("mergeContacts", {
          primary_id: primary.id,
          secondary_id: sec.id,
        });
        if (res?.success) merged++;
        else errors.push(`${contactDisplayName(sec)}: ${res?.error || "unknown"}`);
      } catch (err) {
        errors.push(`${contactDisplayName(sec)}: ${err.message}`);
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setMergingGroupKey(null);
    setMergeResult({ merged, errors, groupLabel: MATCH_CONFIG[group.matchType].label });
  };

  const handleAutoMergeExact = async () => {
    setAutoMerging(true);
    setMergeResult(null);
    let totalMerged = 0;
    let totalGroups = 0;
    const errors = [];
    for (const group of duplicates.exact) {
      const completeness = (c) =>
        [c.first_name, c.last_name, c.email, c.title, c.photo_url, c.biography,
         ...(c.firm_ids || []), ...(c.phones || [])].filter(Boolean).length;
      const primary = [...group.contacts].sort((a, b) => completeness(b) - completeness(a))[0];
      const secondaries = group.contacts.filter((c) => c.id !== primary.id);
      let groupMerged = 0;
      for (const sec of secondaries) {
        try {
          const res = await base44.functions.invoke("mergeContacts", {
            primary_id: primary.id,
            secondary_id: sec.id,
          });
          if (res?.success) { groupMerged++; totalMerged++; }
          else errors.push(`${contactDisplayName(sec)}: ${res?.error || "unknown"}`);
        } catch (err) {
          errors.push(`${contactDisplayName(sec)}: ${err.message}`);
        }
      }
      if (groupMerged > 0) totalGroups++;
    }
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setAutoMerging(false);
    setMergeResult({ merged: totalMerged, groups: totalGroups, errors, autoMerged: true });
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold text-gray-900">Duplicate Contact Matcher</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Detects and merges duplicate contacts by matching names and email addresses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!scanned ? (
            <Button onClick={() => setScanned(true)} disabled={isLoading} className="gap-1">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Scan for Duplicates
            </Button>
          ) : (
            <>
              {duplicates.exact.length > 0 && (
                <Button
                  onClick={handleAutoMergeExact}
                  disabled={autoMerging}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {autoMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Auto-merge {duplicates.exact.length} exact {duplicates.exact.length === 1 ? "match" : "matches"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setScanned(false)} className="gap-1">
                Rescan
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading contacts…
        </div>
      )}

      {/* Summary */}
      {scanned && !isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Exact Matches", value: duplicates.exact.length, config: MATCH_CONFIG.exact },
            { label: "Same Email", value: duplicates.sameEmail.length, config: MATCH_CONFIG.same_email },
            { label: "Same Name", value: duplicates.sameName.length, config: MATCH_CONFIG.same_name },
          ].map((s) => (
            <Card key={s.label} className={`p-3 border ${s.config.border} ${s.config.bg}`}>
              <div className="flex items-center gap-2">
                <s.config.icon className={`w-4 h-4 ${s.config.color}`} />
                <div>
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Merge result */}
      {mergeResult && (
        <div className={`p-3 rounded-lg border ${mergeResult.errors.length > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex items-center gap-2">
            {mergeResult.errors.length > 0 ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <p className="text-sm font-medium text-gray-800">
              {mergeResult.autoMerged
                ? `Auto-merged ${mergeResult.merged} contacts across ${mergeResult.groups || 0} groups.`
                : `Merged ${mergeResult.merged} contacts.`}
              {mergeResult.errors.length > 0 && ` ${mergeResult.errors.length} skipped.`}
            </p>
          </div>
          {mergeResult.errors.length > 0 && (
            <ul className="mt-2 ml-6 text-xs text-gray-600 list-disc space-y-0.5">
              {mergeResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {mergeResult.errors.length > 5 && <li>…and {mergeResult.errors.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}

      {/* Empty state */}
      {scanned && !isLoading && totalGroups === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
          <p className="text-sm font-medium text-gray-700">No duplicates found</p>
          <p className="text-xs text-gray-400">All contacts have unique name + email combinations.</p>
        </div>
      )}

      {/* Duplicate groups */}
      {scanned && !isLoading && totalGroups > 0 && (
        <div className="space-y-4">
          {duplicates.exact.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MATCH_CONFIG.exact.icon className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-700">{MATCH_CONFIG.exact.label}</h2>
                <span className="text-xs text-gray-400">— {MATCH_CONFIG.exact.description}</span>
              </div>
              {duplicates.exact.map((g) => (
                <DuplicateGroup
                  key={g.key}
                  group={g}
                  onMerge={handleMergeGroup}
                  merging={mergingGroupKey === g.key}
                />
              ))}
            </div>
          )}
          {duplicates.sameEmail.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MATCH_CONFIG.same_email.icon className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-700">{MATCH_CONFIG.same_email.label}</h2>
                <span className="text-xs text-gray-400">— {MATCH_CONFIG.same_email.description}</span>
              </div>
              {duplicates.sameEmail.map((g) => (
                <DuplicateGroup
                  key={g.key}
                  group={g}
                  onMerge={handleMergeGroup}
                  merging={mergingGroupKey === g.key}
                />
              ))}
            </div>
          )}
          {duplicates.sameName.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MATCH_CONFIG.same_name.icon className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-gray-700">{MATCH_CONFIG.same_name.label}</h2>
                <span className="text-xs text-gray-400">— {MATCH_CONFIG.same_name.description}</span>
              </div>
              {duplicates.sameName.map((g) => (
                <DuplicateGroup
                  key={g.key}
                  group={g}
                  onMerge={handleMergeGroup}
                  merging={mergingGroupKey === g.key}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}