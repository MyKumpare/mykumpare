import React, { useState, useMemo, useEffect } from "react";
import { Briefcase, Loader2, Check, SkipForward, RefreshCw, AlertTriangle, Type, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { nameSimilarity } from "@/components/contacts/contactTypeSimilarity";
import { OPTION_SIMILARITY_THRESHOLD } from "@/components/contacts/experienceOptionMatch";
import { titleCase } from "@/components/contacts/titleCase";

const THRESHOLD = OPTION_SIMILARITY_THRESHOLD;

/**
 * Build near-duplicate / exact-match pairs from a list of master-list records.
 * Each pair is { a, b, score } where a/b are the original records (with ids).
 * Each record appears in at most one pair (greedy, highest-score first) so the
 * user resolves distinct clusters rather than overlapping combinations.
 */
function buildPairs(records) {
  const recs = records.filter((r) => r && r.name && r.name.trim());
  const pairs = [];
  for (let i = 0; i < recs.length; i++) {
    for (let j = i + 1; j < recs.length; j++) {
      const score = nameSimilarity(recs[i].name, recs[j].name);
      if (score >= THRESHOLD) pairs.push({ a: recs[i], b: recs[j], score });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const used = new Set();
  const result = [];
  for (const p of pairs) {
    if (used.has(p.a.id) || used.has(p.b.id)) continue;
    used.add(p.a.id);
    used.add(p.b.id);
    result.push(p);
  }
  return result;
}

function OptionList({ label, icon, records, pairs, onResolve, resolving }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">({pairs.length} pair{pairs.length === 1 ? "" : "s"})</span>
      </div>
      {pairs.length === 0 ? (
        <p className="text-xs text-gray-400 italic px-1 py-2">
          No near-matches or exact duplicates found. ({records.length} option{records.length === 1 ? "" : "s"} on file)
        </p>
      ) : (
        <div className="space-y-2">
          {pairs.map((p, idx) => (
            <div key={`${p.a.id}-${p.b.id}-${idx}`} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{p.a.name}</span>
                <span className="text-xs text-gray-400">vs</span>
                <span className="text-sm font-medium text-gray-800">{p.b.name}</span>
                <span className="ml-auto text-[11px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                  {Math.round(p.score * 100)}% match
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => onResolve(p, "a")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Keep "{p.a.name}"
                </button>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => onResolve(p, "b")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Keep "{p.b.name}"
                </button>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => onResolve(p, "delete_a")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Delete "{p.a.name}"
                </button>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => onResolve(p, "delete_b")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Delete "{p.b.name}"
                </button>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => onResolve(p, "skip")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  <SkipForward className="w-3 h-3" /> Skip (keep both)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExperienceOptionCleanup() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [titles, setTitles] = useState([]);
  const [resolving, setResolving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([
        base44.entities.CompanyNameOption.list("-created_date", 5000).catch(() => []),
        base44.entities.JobTitleOption.list("-created_date", 5000).catch(() => []),
      ]);
      setCompanies(c.filter((r) => r && r.name));
      setTitles(t.filter((r) => r && r.name));
    } catch (err) {
      toast({ title: "Failed to load options", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const companyPairs = useMemo(() => buildPairs(companies), [companies]);
  const titlePairs = useMemo(() => buildPairs(titles), [titles]);

  /**
   * Merge a duplicate pair: replace the "discard" value with the "keep" value
   * across every contact's professional_experience, then delete the discarded
   * master-list option record.
   */
  const resolvePair = async (pair, choice, field, entityName, setRecords) => {
    if (choice === "skip") {
      setRecords((prev) => prev.filter((r) => r.id !== pair.a.id && r.id !== pair.b.id));
      return;
    }
    if (choice === "delete_a" || choice === "delete_b") {
      const target = choice === "delete_a" ? pair.a : pair.b;
      setResolving(true);
      try {
        await base44.entities[entityName].delete(target.id);
        toast({ title: `Deleted "${target.name}"`, description: "Option removed from the master list." });
        setRecords((prev) => prev.filter((r) => r.id !== pair.a.id && r.id !== pair.b.id));
      } catch (err) {
        toast({ title: "Delete failed", description: err?.message, variant: "destructive" });
      } finally {
        setResolving(false);
      }
      return;
    }
    const keep = choice === "a" ? pair.a : pair.b;
    const discard = choice === "a" ? pair.b : pair.a;
    setResolving(true);
    try {
      const contacts = await base44.entities.Contact.list("-updated_date", 5000).catch(() => []);
      const affected = contacts.filter((c) =>
        (c.professional_experience || []).some((e) => e && e[field] === discard.name)
      );
      if (affected.length > 0) {
        const updates = affected.map((c) => {
          const professional_experience = (c.professional_experience || []).map((e) =>
            e && e[field] === discard.name ? { ...e, [field]: keep.name } : e
          );
          return { id: c.id, professional_experience };
        });
        await base44.entities.Contact.bulkUpdate(updates);
      }
      await base44.entities[entityName].delete(discard.id);
      toast({
        title: `Merged into "${keep.name}"`,
        description: `Replaced ${affected.length} contact reference${affected.length === 1 ? "" : "s"} and removed the duplicate option.`,
      });
      setRecords((prev) => prev.filter((r) => r.id !== pair.a.id && r.id !== pair.b.id));
    } catch (err) {
      toast({ title: "Merge failed", description: err?.message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  /**
   * One-click global normalization: title-case every company and job-title
   * master-list option (merging any options that collapse to the same name)
   * and every contact's professional_experience company_name / title values.
   */
  const normalizeAll = async () => {
    setResolving(true);
    try {
      const [cs, ts, contacts] = await Promise.all([
        base44.entities.CompanyNameOption.list("-created_date", 5000).catch(() => []),
        base44.entities.JobTitleOption.list("-created_date", 5000).catch(() => []),
        base44.entities.Contact.list("-updated_date", 5000).catch(() => []),
      ]);

      const replacements = { company_name: new Map(), title: new Map() };
      const renames = { CompanyNameOption: [], JobTitleOption: [] };
      const deletes = { CompanyNameOption: [], JobTitleOption: [] };

      const plan = (records, entityName, field) => {
        const groups = new Map();
        for (const r of records) {
          const tc = titleCase(r.name);
          if (!groups.has(tc)) groups.set(tc, []);
          groups.get(tc).push(r);
        }
        for (const [tc, recs] of groups) {
          const [keep, ...rest] = recs;
          if (keep.name !== tc) renames[entityName].push({ id: keep.id, name: tc });
          for (const d of rest) {
            replacements[field].set(d.name, tc);
            deletes[entityName].push(d.id);
          }
        }
      };

      plan(cs, "CompanyNameOption", "company_name");
      plan(ts, "JobTitleOption", "title");

      if (renames.CompanyNameOption.length) await base44.entities.CompanyNameOption.bulkUpdate(renames.CompanyNameOption);
      if (renames.JobTitleOption.length) await base44.entities.JobTitleOption.bulkUpdate(renames.JobTitleOption);

      const updates = [];
      for (const c of contacts) {
        if (!c.professional_experience || c.professional_experience.length === 0) continue;
        let changed = false;
        const professional_experience = c.professional_experience.map((e) => {
          if (!e) return e;
          let ne = e;
          if (e.company_name && replacements.company_name.has(e.company_name)) { ne = { ...ne, company_name: replacements.company_name.get(e.company_name) }; changed = true; }
          if (e.title && replacements.title.has(e.title)) { ne = { ...ne, title: replacements.title.get(e.title) }; changed = true; }
          if (ne.company_name && ne.company_name !== titleCase(ne.company_name)) { ne = { ...ne, company_name: titleCase(ne.company_name) }; changed = true; }
          if (ne.title && ne.title !== titleCase(ne.title)) { ne = { ...ne, title: titleCase(ne.title) }; changed = true; }
          return ne;
        });
        if (changed) updates.push({ id: c.id, professional_experience });
      }
      for (let i = 0; i < updates.length; i += 500) {
        await base44.entities.Contact.bulkUpdate(updates.slice(i, i + 500));
      }

      for (const id of deletes.CompanyNameOption) await base44.entities.CompanyNameOption.delete(id);
      for (const id of deletes.JobTitleOption) await base44.entities.JobTitleOption.delete(id);

      toast({
        title: "Normalized to title case",
        description: `Companies: ${renames.CompanyNameOption.length} renamed, ${deletes.CompanyNameOption.length} merged. Titles: ${renames.JobTitleOption.length} renamed, ${deletes.JobTitleOption.length} merged. ${updates.length} contact${updates.length === 1 ? "" : "s"} updated.`,
      });
      await load();
    } catch (err) {
      toast({ title: "Normalize failed", description: err?.message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const totalPairs = companyPairs.length + titlePairs.length;

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-700">Company & Title Cleanup</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Review near-matches and exact duplicates in the professional-experience master lists. Choose which entry to keep — the other is replaced across all contacts and removed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={normalizeAll} disabled={resolving}>
            <Type className="w-3 h-3" /> Normalize to Title Case
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={load} disabled={resolving}>
            <RefreshCw className="w-3 h-3" /> Rescan
          </Button>
        </div>
      </div>

      {totalPairs === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-gray-200 bg-white text-center">
          <Check className="w-6 h-6 text-emerald-500" />
          <p className="text-sm font-medium text-gray-700">No duplicates detected</p>
          <p className="text-xs text-gray-400">All company and title options are unique.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <OptionList
            label="Companies"
            icon={<Briefcase className="w-4 h-4 text-indigo-500" />}
            records={companies}
            pairs={companyPairs}
            resolving={resolving}
            onResolve={(p, choice) => resolvePair(p, choice, "company_name", "CompanyNameOption", setCompanies)}
          />
          <OptionList
            label="Job Titles"
            icon={<Briefcase className="w-4 h-4 text-purple-500" />}
            records={titles}
            pairs={titlePairs}
            resolving={resolving}
            onResolve={(p, choice) => resolvePair(p, choice, "title", "JobTitleOption", setTitles)}
          />
        </div>
      )}
    </div>
  );
}