import React from "react";
import { Building2, User, Package, LayoutList, LineChart, ClipboardList, Clock, AlertCircle, CheckCircle2, XCircle, Calendar, Files, ClipboardCheck, FileText, BarChart2 } from "lucide-react";
import { format } from "date-fns";

function getContactFullName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean).join(" ") +
    (c.designations?.length ? `, ${c.designations.join(", ")}` : "");
}

const NAME_STOPWORDS = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "hon", "jr", "sr", "ii", "iii", "iv", "esq", "cfa", "cpa", "mba", "phd", "md"]);
function normalizeNamePart(s) {
  if (!s) return "";
  return s.toLowerCase().trim().replace(/[.'’-]/g, " ").split(/\s+/).filter((t) => t && !NAME_STOPWORDS.has(t)).join(" ").trim();
}
function nameKey(c) {
  // Use only the first token of the first name so records that store a middle
  // name inside first_name ("Tina Byles") still match records that don't
  // ("Tina"). Last name is kept in full to preserve compound surnames.
  const first = (normalizeNamePart(c.first_name) || "").split(" ")[0] || "";
  const last = normalizeNamePart(c.last_name) || "";
  return `${first}|${last}`;
}
// Collapse duplicate contacts: when two contacts share the same normalized
// first + last name AND at least one firm, only show the most recently
// updated record. Honors the user's preference to surface only the most
// current contact per duplicate name for any related firm.
function dedupeContacts(list) {
  const groups = new Map();
  for (const c of list) {
    if (c.deleted_at) continue;
    const k = nameKey(c);
    if (!k || k === "|") { groups.set(`__${c.id}`, [c]); continue; }
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const fullNameLen = (c) => getContactFullName(c).length;
  const result = [];
  for (const [, group] of groups) {
    const kept = [];
    for (const c of group) {
      const cFirms = new Set(c.firm_ids || []);
      // Collapse when two records share a firm, or when either record has no
      // firm association (historical duplicates often lose their firm link).
      const dupIdx = kept.findIndex((k2) => {
        const k2Firms = new Set(k2.firm_ids || []);
        if (cFirms.size === 0 || k2Firms.size === 0) return true;
        return [...cFirms].some((fid) => k2Firms.has(fid));
      });
      if (dupIdx === -1) {
        kept.push(c);
      } else {
        const existing = kept[dupIdx];
        // Prefer the record with the more complete (longer) full name so the
        // contact's full name is shown; tiebreak by most recently updated.
        if (fullNameLen(c) > fullNameLen(existing) ||
            (fullNameLen(c) === fullNameLen(existing) &&
             new Date(c.updated_date || c.created_date || 0).getTime() >
             new Date(existing.updated_date || existing.created_date || 0).getTime())) {
          kept[dupIdx] = c;
        }
      }
    }
    result.push(...kept);
  }
  return result;
}

function ContactAvatar({ contact, size = "sm" }) {
  const sz = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  return (
    <div className={`${sz} rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-indigo-200`}>
      {contact.photo_url ? (
        <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <User className="w-3.5 h-3.5 text-indigo-400" />
      )}
    </div>
  );
}

function FirmLogo({ firm }) {
  return (
    <div className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
      {firm.logo_url ? (
        <img src={firm.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
      ) : (
        <Building2 className="w-3.5 h-3.5 text-gray-400" />
      )}
    </div>
  );
}

const TASK_STATUS_ICON = {
  "Not Started": Clock,
  "In-process": AlertCircle,
  "Completed": CheckCircle2,
  "Cancelled": XCircle,
};
const TASK_STATUS_COLOR = {
  "Not Started": "text-gray-500",
  "In-process": "text-blue-600",
  "Completed": "text-green-600",
  "Cancelled": "text-red-500",
};

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// Split the query into individual keywords. Each keyword is matched
// independently across an entity's searchable fields. An entity is included
// if it matches at least one keyword; results are ranked by how many
// keyword-field pairs match (most matches first).
const KEYWORD_MIN_LEN = 2;
function parseKeywords(query) {
  const raw = (query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  // Drop tiny tokens unless the entire query is a single short token
  if (raw.length > 1) return raw.filter((t) => t.length >= KEYWORD_MIN_LEN || raw.length === 1);
  return raw;
}
// Count how many (keyword, field) pairs match across the provided field values.
// A field matches a keyword when the keyword appears as a substring of that
// field's value. Returns 0 if nothing matches.
function scoreFields(keywords, fields) {
  if (!keywords.length) return 0;
  const haystacks = (Array.isArray(fields) ? fields : [fields])
    .filter((v) => v != null && v !== "")
    .map((v) => v.toLowerCase());
  let score = 0;
  for (const kw of keywords) {
    for (const hay of haystacks) {
      if (hay.includes(kw)) {
        score += 1;
        // A keyword only needs to match once per entity for ranking purposes
        break;
      }
    }
  }
  return score;
}

export default function SearchResults({ query, firms, products, contacts, portfolios = [], analyses = [], activities = [], followUpTasks = [], documents = [], dueDiligences = [], customReports = [], benchmarks = [], onFirmClick, onContactClick, onProductClick, onPortfolioClick, onAnalysisClick, onActivityClick, onTaskClick, onDocumentClick, onDueDiligenceClick, onReportClick, onBenchmarkClick }) {
  const keywords = parseKeywords(query);
  if (!keywords.length) return null;

  const byScoreDesc = (a, b) => b._score - a._score;

  // --- Match contacts (excluding soft-deleted), then collapse duplicates ---
  const matchedContacts = dedupeContacts(
    contacts
      .map((c) => ({
        ...c,
        _score: scoreFields(keywords, [
          getContactFullName(c),
          c.email,
          c.title,
          (c.designations || []).join(" "),
        ]),
      }))
      .filter((c) => c._score > 0)
  ).sort(byScoreDesc);

  // --- Match firms (excluding soft-deleted) ---
  const matchedFirms = firms
    .filter((f) => !f.deleted_at)
    .map((f) => ({
      ...f,
      _score: scoreFields(keywords, [f.name, f.firm_type, (f.firm_types || []).join(" "), f.website, f.email, f.description]),
    }))
    .filter((f) => f._score > 0)
    .sort(byScoreDesc);

  // --- Match products (excluding soft-deleted) ---
  const matchedProducts = products
    .filter((p) => !p.deleted_at)
    .map((p) => ({
      ...p,
      _score: scoreFields(keywords, [p.name, p.description, p.asset_class, p.geography, p.market_cap, p.style, p.investment_process, p.firm_name]),
    }))
    .filter((p) => p._score > 0)
    .sort(byScoreDesc);

  // --- Match portfolios (excluding soft-deleted) ---
  const matchedPortfolios = portfolios
    .filter((p) => !p.deleted_at)
    .map((p) => ({
      ...p,
      _score: scoreFields(keywords, [p.portfolio_name, p.allocator_name, p.advisor_firm_name]),
    }))
    .filter((p) => p._score > 0)
    .sort(byScoreDesc);

  // --- Match analyses ---
  const matchedAnalyses = analyses
    .map((a) => ({ ...a, _score: scoreFields(keywords, [a.name, a.description]) }))
    .filter((a) => a._score > 0)
    .sort(byScoreDesc);

  // --- Match activities ---
  const matchedActivities = activities
    .map((a) => ({
      ...a,
      _score: scoreFields(keywords, [
        (a.subject || ""),
        (a.activity_type || ""),
        stripHtml(a.notes),
        (a.associated_firms_contacts || [])
          .flatMap((fc) => [fc.firm_name, ...(fc.contacts || []).map((ct) => ct.contact_name)])
          .join(" "),
      ]),
    }))
    .filter((a) => a._score > 0)
    .sort(byScoreDesc);

  // --- Match follow-up tasks ---
  const matchedTasks = followUpTasks
    .map((t) => ({
      ...t,
      _score: scoreFields(keywords, [
        stripHtml(t.task_description),
        t.originator_contact_name,
        t.assigned_to_contact_name,
        t.assigned_to_firm_name,
        t.status,
      ]),
    }))
    .filter((t) => t._score > 0)
    .sort(byScoreDesc);

  // --- Match documents (by sub-category, category, name, firm, description) ---
  const matchedDocuments = documents
    .map((d) => ({
      ...d,
      _score: scoreFields(keywords, [
        d.file_name,
        d.firm_name,
        d.description,
        d.summary,
        (d.categories || []).join(" "),
        (d.sub_categories || []).join(" "),
      ]),
    }))
    .filter((d) => d._score > 0)
    .sort(byScoreDesc);

  // --- Match due diligence records (by product, firm, analysts, status) ---
  const matchedDueDiligences = dueDiligences
    .filter((r) => !r.deleted_at)
    .map((r) => ({
      ...r,
      _score: scoreFields(keywords, [
        r.product_name,
        r.firm_name,
        r.primary_analyst_name,
        r.secondary_analyst_name,
        r.status,
        r.process_status,
      ]),
    }))
    .filter((r) => r._score > 0)
    .sort(byScoreDesc);

  // --- Match custom reports (by name, description, source, format) ---
  const matchedReports = customReports
    .map((r) => ({
      ...r,
      _score: scoreFields(keywords, [
        r.name,
        r.description,
        r.data_source,
        r.format_type,
        r.chart_type,
        r.group_by,
        r.filters_description,
      ]),
    }))
    .filter((r) => r._score > 0)
    .sort(byScoreDesc);

  // --- Match benchmarks (by name, description, asset class, region, style) ---
  const matchedBenchmarks = benchmarks
    .map((b) => ({
      ...b,
      _score: scoreFields(keywords, [
        b.name,
        b.description,
        b.asset_class,
        b.region,
        b.market_capitalization,
        b.style,
      ]),
    }))
    .filter((b) => b._score > 0)
    .sort(byScoreDesc);

  // For a firm result, gather its contacts (deduped so the same person —
  // e.g. one record with a salutation and one without — shows only once,
  // surfacing the most complete full name).
  const firmContacts = (firmId) => dedupeContacts(contacts.filter(c => (c.firm_ids || []).includes(firmId)));

  // For a contact result, gather its firms
  const contactFirms = (contact) => (contact.firm_ids || []).map(id => firms.find(f => f.id === id)).filter(Boolean);

  // For a product result, gather the firm and its contacts
  const productFirm = (product) => firms.find(f => f.id === product.firm_id);
  const productFirmContacts = (product) => {
    const firm = productFirm(product);
    return firm ? firmContacts(firm.id) : [];
  };

  const hasAny = matchedContacts.length > 0 || matchedFirms.length > 0 || matchedProducts.length > 0 || matchedPortfolios.length > 0 || matchedAnalyses.length > 0 || matchedActivities.length > 0 || matchedTasks.length > 0 || matchedDocuments.length > 0 || matchedDueDiligences.length > 0 || matchedReports.length > 0 || matchedBenchmarks.length > 0;
  if (!hasAny) return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 text-sm text-gray-400 text-center">
      No results for "{query}"
    </div>
  );

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[70vh] overflow-y-auto divide-y divide-gray-100">

      {/* Firm Results */}
      {matchedFirms.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Firms
          </div>
          {matchedFirms.map((firm) => {
            const assocContacts = firmContacts(firm.id);
            return (
              <button
                key={firm.id}
                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors"
                onClick={() => onFirmClick(firm)}
              >
                <div className="flex items-start gap-3">
                  <FirmLogo firm={firm} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{firm.name}</div>
                    <div className="text-xs text-gray-400">{firm.firm_type}</div>
                    {assocContacts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {assocContacts.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                            <div className="w-3.5 h-3.5 rounded-full overflow-hidden bg-indigo-200 flex-shrink-0">
                              {c.photo_url
                                ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                                : <User className="w-2.5 h-2.5 text-indigo-400 m-auto" />}
                            </div>
                            {getContactFullName(c)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Contact Results */}
      {matchedContacts.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Contacts
          </div>
          {matchedContacts.map((contact) => {
            const assocFirms = contactFirms(contact);
            return (
              <button
                key={contact.id}
                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors"
                onClick={() => onContactClick(contact)}
              >
                <div className="flex items-start gap-3">
                  <ContactAvatar contact={contact} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {getContactFullName(contact)}
                    </div>
                    {contact.title && <div className="text-xs text-gray-500 truncate">{contact.title}</div>}
                    {assocFirms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {assocFirms.map(f => (
                          <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-md px-1.5 py-0.5">
                            {f.logo_url ? <img src={f.logo_url} alt="" className="w-3 h-3 object-contain" /> : <Building2 className="w-3 h-3" />}
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Product Results */}
      {matchedProducts.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Products
          </div>
          {matchedProducts.map((product) => {
            const firm = productFirm(product);
            const assocContacts = productFirmContacts(product);
            return (
              <button
                key={product.id}
                className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors"
                onClick={() => onProductClick(product)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg border border-violet-200 bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Package className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                    {firm && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {firm.logo_url ? <img src={firm.logo_url} alt="" className="w-3 h-3 object-contain" /> : <Building2 className="w-3 h-3 text-gray-400" />}
                        <span className="text-xs text-gray-500">{firm.name}</span>
                      </div>
                    )}
                    {assocContacts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {assocContacts.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                            <div className="w-3.5 h-3.5 rounded-full overflow-hidden bg-indigo-200 flex-shrink-0">
                              {c.photo_url
                                ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                                : <User className="w-2.5 h-2.5 text-indigo-400 m-auto" />}
                            </div>
                            {getContactFullName(c)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Portfolio Results */}
      {matchedPortfolios.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <LayoutList className="w-3.5 h-3.5" /> Portfolios
          </div>
          {matchedPortfolios.map((portfolio) => {
            const allocatorFirm = firms.find(f => f.id === portfolio.firm_id);
            return (
              <button
                key={portfolio.id}
                className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
                onClick={() => onPortfolioClick && onPortfolioClick(portfolio)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <LayoutList className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{portfolio.portfolio_name}</div>
                    {allocatorFirm && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {allocatorFirm.logo_url ? <img src={allocatorFirm.logo_url} alt="" className="w-3 h-3 object-contain" /> : <Building2 className="w-3 h-3 text-gray-400" />}
                        <span className="text-xs text-gray-500">{allocatorFirm.name}</span>
                      </div>
                    )}
                    {portfolio.advisor_firm_name && (
                      <div className="text-xs text-emerald-600 mt-0.5">{portfolio.advisor_type}: {portfolio.advisor_firm_name}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Activity Results */}
      {matchedActivities.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Activities
          </div>
          {matchedActivities.map((activity) => (
            <button
              key={activity.id}
              className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors"
              onClick={() => onActivityClick && onActivityClick(activity)}
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{activity.subject || "(No subject)"}</span>
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{activity.activity_type}</span>
                  </div>
                  {activity.activity_date && (
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {fmtDate(activity.activity_date)}
                    </div>
                  )}
                  {activity.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{stripHtml(activity.notes)}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Follow-up Task Results */}
      {matchedTasks.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <LayoutList className="w-3.5 h-3.5 text-orange-500" /> Follow-up Tasks
          </div>
          {matchedTasks.map((task) => {
            const StatusIcon = TASK_STATUS_ICON[task.status] || Clock;
            const statusColor = TASK_STATUS_COLOR[task.status] || "text-gray-500";
            return (
              <button
                key={task.id}
                className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors"
                onClick={() => onTaskClick && onTaskClick(task)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg border border-orange-200 bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 ${statusColor}`}>{task.status}</span>
                      {task.due_date && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {fmtDate(task.due_date)}
                        </span>
                      )}
                    </div>
                    {task.task_description && (
                      <p className="text-xs text-gray-700 mt-0.5 line-clamp-1">{stripHtml(task.task_description)}</p>
                    )}
                    {task.originator_contact_name && (
                      <p className="text-xs text-gray-400 mt-0.5">By: {task.originator_contact_name}{task.assigned_to_contact_name ? ` → ${task.assigned_to_contact_name}` : ""}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Analysis Results */}
      {matchedAnalyses.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <LineChart className="w-3.5 h-3.5" /> Saved Analyses
          </div>
          {matchedAnalyses.map((analysis) => (
            <button
              key={analysis.id}
              className="w-full text-left px-4 py-3 hover:bg-cyan-50 transition-colors"
              onClick={() => onAnalysisClick && onAnalysisClick(analysis)}
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg border border-cyan-200 bg-cyan-50 flex items-center justify-center flex-shrink-0">
                  <LineChart className="w-3.5 h-3.5 text-cyan-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{analysis.name}</span>
                    {analysis.is_template && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Template</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {analysis.analysis_type === "single" ? "Single Product" : "Multi-Product"} · {analysis.visibility === "firm" ? "Firm-wide" : "Personal"}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Due Diligence Results */}
      {matchedDueDiligences.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" /> Due Diligence
          </div>
          {matchedDueDiligences.map((rec) => (
            <button
              key={rec.id}
              className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors"
              onClick={() => onDueDiligenceClick && onDueDiligenceClick(rec)}
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg border border-indigo-200 bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{rec.product_name || "(No product)"}</span>
                    {rec.status && (
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{rec.status}</span>
                    )}
                    {rec.process_status && (
                      <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{rec.process_status}</span>
                    )}
                  </div>
                  {rec.firm_name && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500 truncate">{rec.firm_name}</span>
                    </div>
                  )}
                  {(rec.primary_analyst_name || rec.secondary_analyst_name) && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {rec.primary_analyst_name ? `Primary: ${rec.primary_analyst_name}` : ""}
                      {rec.secondary_analyst_name ? `${rec.primary_analyst_name ? " · " : ""}Secondary: ${rec.secondary_analyst_name}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Report Results */}
      {matchedReports.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Reports
          </div>
          {matchedReports.map((report) => (
            <button
              key={report.id}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
              onClick={() => onReportClick && onReportClick(report)}
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg border border-blue-200 bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{report.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {report.data_source ? report.data_source : "Report"}{report.format_type ? ` · ${report.format_type}` : ""}{report.chart_type ? ` · ${report.chart_type}` : ""}
                  </div>
                  {report.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{report.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Benchmark Results */}
      {matchedBenchmarks.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> Benchmarks
          </div>
          {matchedBenchmarks.map((benchmark) => (
            <button
              key={benchmark.id}
              className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors"
              onClick={() => onBenchmarkClick && onBenchmarkClick(benchmark)}
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg border border-purple-200 bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{benchmark.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                    {benchmark.asset_class && <span>{benchmark.asset_class}</span>}
                    {benchmark.region && <span>· {benchmark.region}</span>}
                    {benchmark.market_capitalization && <span>· {benchmark.market_capitalization}</span>}
                    {benchmark.style && <span>· {benchmark.style}</span>}
                  </div>
                  {benchmark.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{benchmark.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Document Results */}
      {matchedDocuments.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Files className="w-3.5 h-3.5" /> Documents
          </div>
          {matchedDocuments.map((doc) => (
            <button
              key={doc.id}
              className="w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors"
              onClick={() => onDocumentClick && onDocumentClick(doc)}
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg border border-teal-200 bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <Files className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</div>
                  {doc.firm_name && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500 truncate">{doc.firm_name}</span>
                    </div>
                  )}
                  {(doc.sub_categories?.length > 0 || doc.categories?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {doc.categories.map((c) => (
                        <span key={`c-${c}`} className="text-[10px] bg-indigo-50 text-indigo-600 rounded-full px-1.5 py-0.5">{c}</span>
                      ))}
                      {doc.sub_categories.map((s) => (
                        <span key={`s-${s}`} className="text-[10px] bg-amber-50 text-amber-600 rounded-full px-1.5 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}