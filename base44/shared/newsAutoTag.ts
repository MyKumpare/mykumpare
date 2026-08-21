// Auto-tags FirmNews records with contacts/firms whose names appear in the
// headline or summary. Shared by the news scrub functions (scrubFirmNews,
// scrubFirmNewsHistorical) and the manual-entry autoTagNewsMention endpoint so
// mentions are linked automatically — users can still untag via the tag popovers.

const FIRM_SUFFIXES = [
  ', inc.', ' inc.', ', inc', ' incorporated',
  ', llc', ' llc',
  ', lp', ' lp', ', l.p.',
  ', ltd', ' ltd',
  ', llp', ' llp',
  ' & co.', ', co.',
  ' holdings', ' partners',
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Strip common legal suffixes so "Xponance, Inc." matches a bare "Xponance" mention.
function cleanFirmName(name) {
  let n = (name || '').trim().toLowerCase();
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of FIRM_SUFFIXES) {
      if (n.endsWith(s) && n.length - s.length >= 3) {
        n = n.slice(0, -s.length).trim();
        changed = true;
        break;
      }
    }
  }
  return n;
}

function wordBoundaryMatch(text, term) {
  if (!term || term.length < 2) return false;
  return new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(text);
}

// "First Last", "First Middle Last", "First M. Last" — contiguous full-name variants.
function buildNameVariants(contact) {
  const first = (contact.first_name || '').trim();
  const last = (contact.last_name || '').trim();
  const middle = (contact.middle_name || '').trim();
  const variants = [];
  if (first && last) variants.push(`${first} ${last}`);
  if (first && middle && last) {
    variants.push(`${first} ${middle} ${last}`);
    if (middle.length === 1) variants.push(`${first} ${middle}. ${last}`);
  }
  return variants;
}

// True if `a` and `b` both occur as whole words within maxDist chars of each other.
function withinProximity(text, a, b, maxDist) {
  const reA = new RegExp(`\\b${escapeRegex(a)}\\b`, 'gi');
  const reB = new RegExp(`\\b${escapeRegex(b)}\\b`, 'gi');
  const aIdx = [];
  let m;
  while ((m = reA.exec(text)) !== null) { aIdx.push(m.index); if (aIdx.length > 20) break; }
  const bIdx = [];
  while ((m = reB.exec(text)) !== null) { bIdx.push(m.index); if (bIdx.length > 20) break; }
  for (const ai of aIdx) for (const bi of bIdx) {
    if (Math.abs(ai - bi) <= maxDist) return true;
  }
  return false;
}

export function findMentionedContactIds(text, contacts) {
  const lower = (text || '').toLowerCase();
  const ids = new Set();
  for (const c of contacts) {
    const first = (c.first_name || '').trim();
    const last = (c.last_name || '').trim();
    if (!first || !last || last.length < 3) continue;
    // 1. contiguous full-name variant (handles middle names/initials like "Michael A.B. Orr")
    const variants = buildNameVariants(c);
    if (variants.some(v => lower.includes(v.toLowerCase()))) { ids.add(c.id); continue; }
    // 2. fallback: first AND last both appear as whole words near each other (handles "Tina Byles Williams")
    if (first.length >= 2 && wordBoundaryMatch(text, first) && wordBoundaryMatch(text, last)
        && withinProximity(text, first, last, 40)) { ids.add(c.id); continue; }
  }
  return Array.from(ids);
}

export function findMentionedFirmIds(text, firms, excludeFirmId) {
  const ids = new Set();
  for (const f of firms) {
    if (excludeFirmId && f.id === excludeFirmId) continue;
    const clean = cleanFirmName(f.name);
    if (clean.length < 3) continue;
    if (wordBoundaryMatch(text, clean) || wordBoundaryMatch(text, (f.name || '').trim())) {
      ids.add(f.id);
    }
  }
  return Array.from(ids);
}

function sameArr(a, b) {
  if (!Array.isArray(a)) a = [];
  if (!Array.isArray(b)) b = [];
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

// Tag a list of news items against a preloaded set of contacts/firms.
// Merges with existing tags (never removes user-added tags).
export async function autoTagNewsItemsWith(base44, newsItems, contacts, firms) {
  const results = [];
  for (const item of newsItems) {
    if (!item || item.deleted_at) continue;
    const text = `${item.headline || ''} ${item.summary || ''}`;
    const mentionedContacts = findMentionedContactIds(text, contacts);
    const mentionedFirms = findMentionedFirmIds(text, firms, item.firm_id);
    const existingContacts = item.tagged_contact_ids || [];
    const existingFirms = item.tagged_firm_ids || [];
    const mergedContacts = Array.from(new Set([...existingContacts, ...mentionedContacts]));
    const mergedFirms = Array.from(new Set([...existingFirms, ...mentionedFirms]));
    if (!sameArr(mergedContacts, existingContacts) || !sameArr(mergedFirms, existingFirms)) {
      try {
        await base44.asServiceRole.entities.FirmNews.update(item.id, {
          tagged_contact_ids: mergedContacts,
          tagged_firm_ids: mergedFirms,
        });
        results.push({ id: item.id, tagged_contact_ids: mergedContacts, tagged_firm_ids: mergedFirms });
      } catch (e) {
        console.error('autoTag update failed for', item.id, e.message);
      }
    }
  }
  return results;
}

// Fetch contacts/firms once (unless provided), then tag all given news items.
export async function autoTagNewsItems(base44, newsItems, contacts = null, firms = null) {
  if (!newsItems || !newsItems.length) return [];
  let activeContacts = contacts;
  let activeFirms = firms;
  if (!activeContacts || !activeFirms) {
    const [c, f] = await Promise.all([
      base44.asServiceRole.entities.Contact.list('-created_date', 5000).catch(() => []),
      base44.asServiceRole.entities.Firm.list('-created_date', 5000).catch(() => []),
    ]);
    activeContacts = c.filter(x => !x.deleted_at);
    activeFirms = f.filter(x => !x.deleted_at);
  }
  return autoTagNewsItemsWith(base44, newsItems, activeContacts, activeFirms);
}

// Tag a single news item by id (used after manual creation).
export async function autoTagNewsItemById(base44, newsId) {
  const item = await base44.asServiceRole.entities.FirmNews.get(newsId);
  if (!item || item.deleted_at) return null;
  const results = await autoTagNewsItems(base44, [item]);
  return results[0] || null;
}