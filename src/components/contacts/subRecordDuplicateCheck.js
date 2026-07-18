// Duplicate / similarity detection for contact sub-record arrays
// (education, professional experience, phones). Each record carries a stable
// `id`, so detected pairs reference records by id and resolutions stay stable
// regardless of the order operations are applied.

const norm = (s) =>
  (s || "").toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Education: same normalized institution (non-empty) ──
export function findEducationDuplicates(education = []) {
  const pairs = [];
  for (let i = 0; i < education.length; i++) {
    for (let j = i + 1; j < education.length; j++) {
      const a = education[i];
      const b = education[j];
      const ai = norm(a.institution);
      const bi = norm(b.institution);
      if (!ai || !bi) continue;
      if (ai === bi) {
        pairs.push({ type: "education", aId: a.id, bId: b.id, a, b, reason: "Same institution" });
      }
    }
  }
  return pairs;
}

// ── Professional experience: same normalized company name ──
export function findExperienceDuplicates(experience = []) {
  const pairs = [];
  for (let i = 0; i < experience.length; i++) {
    for (let j = i + 1; j < experience.length; j++) {
      const a = experience[i];
      const b = experience[j];
      const ac = norm(a.company_name);
      const bc = norm(b.company_name);
      if (!ac || !bc) continue;
      if (ac === bc) {
        pairs.push({ type: "experience", aId: a.id, bId: b.id, a, b, reason: "Same company" });
      }
    }
  }
  return pairs;
}

// ── Phones: same area_code + number_mid + number_last digits ──
export function findPhoneDuplicates(phones = []) {
  const pairs = [];
  for (let i = 0; i < phones.length; i++) {
    for (let j = i + 1; j < phones.length; j++) {
      const a = phones[i];
      const b = phones[j];
      const ad = [a.area_code, a.number_mid, a.number_last].filter(Boolean).join("");
      const bd = [b.area_code, b.number_mid, b.number_last].filter(Boolean).join("");
      if (!ad || !bd) continue;
      if (ad === bd) {
        pairs.push({ type: "phones", aId: a.id, bId: b.id, a, b, reason: "Same phone number" });
      }
    }
  }
  return pairs;
}

// ── Merge helpers: combine two records, preferring non-empty values ──
function mergeEducation(a, b) {
  return {
    id: a.id,
    institution: a.institution || b.institution,
    graduation_year: a.graduation_year || b.graduation_year,
    degree: a.degree || b.degree,
    area_of_specialization: a.area_of_specialization || b.area_of_specialization,
    majors: Array.from(new Set([...(a.majors || []), ...(b.majors || [])])),
    minors: Array.from(new Set([...(a.minors || []), ...(b.minors || [])])),
  };
}

function mergeExperience(a, b) {
  return {
    id: a.id,
    company_name: a.company_name || b.company_name,
    title: a.title || b.title,
    start_year: a.start_year || b.start_year,
    end_year: a.end_year || b.end_year,
  };
}

function mergePhone(a, b) {
  return {
    id: a.id,
    phone_type: a.phone_type || b.phone_type,
    country_code: a.country_code || b.country_code,
    area_code: a.area_code || b.area_code,
    number_mid: a.number_mid || b.number_mid,
    number_last: a.number_last || b.number_last,
    is_default: a.is_default || b.is_default,
  };
}

export function mergePair(type, a, b) {
  if (type === "education") return mergeEducation(a, b);
  if (type === "experience") return mergeExperience(a, b);
  if (type === "phones") return mergePhone(a, b);
  return { ...a, ...b };
}

// Apply a set of per-pair decisions to the working arrays and return resolved
// arrays. decisions: { [pairKey]: "accept" | "merge" | "delete" }
// pairKey = `${type}::${aId}::${bId}`
export function resolveSubRecordDuplicates(arrays, pairs, decisions) {
  let education = [...(arrays.education || [])];
  let professional_experience = [...(arrays.professional_experience || [])];
  let phones = [...(arrays.phones || [])];

  const getArr = (type) => (type === "education" ? education : type === "experience" ? professional_experience : phones);
  const setArr = (type, val) => {
    if (type === "education") education = val;
    else if (type === "experience") professional_experience = val;
    else phones = val;
  };

  for (const p of pairs) {
    const key = `${p.type}::${p.aId}::${p.bId}`;
    const action = decisions[key] || "accept";
    if (action === "accept") continue;
    let arr = getArr(p.type);
    if (action === "merge") {
      const a = arr.find((x) => x.id === p.aId);
      const b = arr.find((x) => x.id === p.bId);
      if (a && b) {
        const merged = mergePair(p.type, a, b);
        arr = arr.map((x) => (x.id === a.id ? merged : x)).filter((x) => x.id !== b.id);
      }
    } else if (action === "delete") {
      arr = arr.filter((x) => x.id !== p.bId);
    }
    setArr(p.type, arr);
  }

  return { education, professional_experience, phones };
}

// Summary label for a single sub-record (used by the review dialog)
export function summarizeSubRecord(type, rec) {
  if (!rec) return "—";
  if (type === "education") {
    return [rec.institution, rec.degree, rec.graduation_year].filter(Boolean).join(" · ") || "Untitled education";
  }
  if (type === "experience") {
    const span = [rec.start_year || "?", rec.end_year || "Present"].join("–");
    return [rec.company_name, rec.title, span].filter(Boolean).join(" · ") || "Untitled experience";
  }
  if (type === "phones") {
    return [rec.country_code ? `+${rec.country_code}` : null, rec.area_code ? `(${rec.area_code})` : null, [rec.number_mid, rec.number_last].filter(Boolean).join("-") || null].filter(Boolean).join(" ") || "Untitled phone";
  }
  return "—";
}