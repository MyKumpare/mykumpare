// Geographic region options for firms. Used by the firm form (region picker)
// and the analyst coverage dashboard (region filter + heatmap).
export const GEOGRAPHIC_REGIONS = [
  "Undefined",
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
];

// Default target firm count per analyst for the capacity indicator on the
// management coverage dashboard. Used when no per-analyst override is set.
export const DEFAULT_ANALYST_CAPACITY_TARGET = 8;

// Maps a country name or ISO code to one of the geographic regions above.
// Returns null when the country cannot be classified.
export function countryToGeographicRegion(country) {
  if (!country) return null;
  const c = country.trim().toLowerCase();

  const isoMap = {
    // North America
    us: "North America", usa: "North America", can: "North America", ca: "North America", mx: "North America", mex: "North America", pr: "North America", gu: "North America",
    // Europe
    gb: "Europe", uk: "Europe", gbr: "Europe", ie: "Europe", irl: "Europe", de: "Europe", deu: "Europe", fr: "Europe", fra: "Europe", es: "Europe", esp: "Europe", it: "Europe", ita: "Europe", pt: "Europe", prt: "Europe", nl: "Europe", nld: "Europe", be: "Europe", bel: "Europe", lu: "Europe", lux: "Europe", ch: "Europe", che: "Europe", at: "Europe", aut: "Europe", se: "Europe", swe: "Europe", no: "Europe", nor: "Europe", dk: "Europe", dnk: "Europe", fi: "Europe", fin: "Europe", is: "Europe", isl: "Europe", pl: "Europe", pol: "Europe", cz: "Europe", cze: "Europe", sk: "Europe", svk: "Europe", hu: "Europe", hun: "Europe", ro: "Europe", rou: "Europe", bg: "Europe", bgr: "Europe", gr: "Europe", grc: "Europe", hr: "Europe", hrv: "Europe", si: "Europe", svn: "Europe", rs: "Europe", srb: "Europe", ba: "Europe", bih: "Europe", me: "Europe", mne: "Europe", al: "Europe", alb: "Europe", mk: "Europe", mkd: "Europe", ee: "Europe", est: "Europe", lv: "Europe", lva: "Europe", lt: "Europe", ltu: "Europe", ru: "Europe", rus: "Europe", ua: "Europe", ukr: "Europe", by: "Europe", blr: "Europe", md: "Europe", mda: "Europe", mt: "Europe", mlt: "Europe", cy: "Europe", cyp: "Europe", ad: "Europe", and: "Europe", mc: "Europe", mco: "Europe", li: "Europe", lie: "Europe", sm: "Europe", smr: "Europe", va: "Europe", vat: "Europe", fo: "Europe", fro: "Europe", gi: "Europe", gib: "Europe", im: "Europe", je: "Europe", jer: "Europe", gg: "Europe", ggy: "Europe",
    // Asia-Pacific
    jp: "Asia-Pacific", jpn: "Asia-Pacific", cn: "Asia-Pacific", chn: "Asia-Pacific", kr: "Asia-Pacific", kor: "Asia-Pacific", kp: "Asia-Pacific", prk: "Asia-Pacific", tw: "Asia-Pacific", twn: "Asia-Pacific", hk: "Asia-Pacific", hkg: "Asia-Pacific", sg: "Asia-Pacific", sgp: "Asia-Pacific", my: "Asia-Pacific", mys: "Asia-Pacific", th: "Asia-Pacific", tha: "Asia-Pacific", id: "Asia-Pacific", idn: "Asia-Pacific", ph: "Asia-Pacific", phl: "Asia-Pacific", vn: "Asia-Pacific", vnm: "Asia-Pacific", kh: "Asia-Pacific", khm: "Asia-Pacific", la: "Asia-Pacific", lao: "Asia-Pacific", mm: "Asia-Pacific", mmr: "Asia-Pacific", bn: "Asia-Pacific", brn: "Asia-Pacific", tl: "Asia-Pacific", tls: "Asia-Pacific", in: "Asia-Pacific", ind: "Asia-Pacific", pk: "Asia-Pacific", pak: "Asia-Pacific", bd: "Asia-Pacific", bgd: "Asia-Pacific", lk: "Asia-Pacific", lka: "Asia-Pacific", np: "Asia-Pacific", npl: "Asia-Pacific", bt: "Asia-Pacific", btn: "Asia-Pacific", mv: "Asia-Pacific", mdv: "Asia-Pacific", au: "Asia-Pacific", aus: "Asia-Pacific", nz: "Asia-Pacific", nzl: "Asia-Pacific", fj: "Asia-Pacific", fji: "Asia-Pacific", pg: "Asia-Pacific", png: "Asia-Pacific", sb: "Asia-Pacific", slb: "Asia-Pacific", vu: "Asia-Pacific", vut: "Asia-Pacific", ws: "Asia-Pacific", wsm: "Asia-Pacific", to: "Asia-Pacific", ton: "Asia-Pacific", mn: "Asia-Pacific", mng: "Asia-Pacific", kz: "Asia-Pacific", kaz: "Asia-Pacific", uz: "Asia-Pacific", uzb: "Asia-Pacific", tm: "Asia-Pacific", tkm: "Asia-Pacific", kg: "Asia-Pacific", kgz: "Asia-Pacific", tj: "Asia-Pacific", tjk: "Asia-Pacific", af: "Asia-Pacific", afg: "Asia-Pacific",
    // Latin America
    br: "Latin America", bra: "Latin America", ar: "Latin America", arg: "Latin America", cl: "Latin America", chl: "Latin America", co: "Latin America", col: "Latin America", pe: "Latin America", per: "Latin America", ve: "Latin America", ven: "Latin America", ec: "Latin America", ecu: "Latin America", bo: "Latin America", bol: "Latin America", py: "Latin America", pry: "Latin America", uy: "Latin America", ury: "Latin America", gy: "Latin America", guy: "Latin America", sr: "Latin America", sur: "Latin America", cu: "Latin America", cub: "Latin America", do: "Latin America", dom: "Latin America", ht: "Latin America", hti: "Latin America", jm: "Latin America", jam: "Latin America", tt: "Latin America", tto: "Latin America", bb: "Latin America", brb: "Latin America", bs: "Latin America", bhs: "Latin America", gd: "Latin America", grd: "Latin America", ag: "Latin America", atg: "Latin America", dm: "Latin America", dma: "Latin America", lc: "Latin America", lca: "Latin America", vc: "Latin America", vct: "Latin America", kn: "Latin America", kna: "Latin America", bz: "Latin America", blz: "Latin America", cr: "Latin America", cri: "Latin America", sv: "Latin America", slv: "Latin America", gt: "Latin America", gtm: "Latin America", hn: "Latin America", hnd: "Latin America", ni: "Latin America", nic: "Latin America", pa: "Latin America", pan: "Latin America", cw: "Latin America", cuw: "Latin America", aw: "Latin America", abw: "Latin America", ky: "Latin America", cym: "Latin America", bm: "Latin America", bmu: "Latin America", vg: "Latin America", vgb: "Latin America",
    // Middle East & Africa
    sa: "Middle East & Africa", sau: "Middle East & Africa", ae: "Middle East & Africa", are: "Middle East & Africa", qa: "Middle East & Africa", qat: "Middle East & Africa", kw: "Middle East & Africa", kwt: "Middle East & Africa", bh: "Middle East & Africa", bhr: "Middle East & Africa", om: "Middle East & Africa", omn: "Middle East & Africa", ye: "Middle East & Africa", yem: "Middle East & Africa", jo: "Middle East & Africa", jor: "Middle East & Africa", lb: "Middle East & Africa", lbn: "Middle East & Africa", sy: "Middle East & Africa", syr: "Middle East & Africa", il: "Middle East & Africa", isr: "Middle East & Africa", ps: "Middle East & Africa", pse: "Middle East & Africa", eg: "Middle East & Africa", egy: "Middle East & Africa", ly: "Middle East & Africa", lby: "Middle East & Africa", tn: "Middle East & Africa", tun: "Middle East & Africa", dz: "Middle East & Africa", dza: "Middle East & Africa", ma: "Middle East & Africa", mar: "Middle East & Africa", sd: "Middle East & Africa", sdn: "Middle East & Africa", ss: "Middle East & Africa", ssd: "Middle East & Africa", et: "Middle East & Africa", eth: "Middle East & Africa", er: "Middle East & Africa", eri: "Middle East & Africa", dj: "Middle East & Africa", dji: "Middle East & Africa", so: "Middle East & Africa", som: "Middle East & Africa", ke: "Middle East & Africa", ken: "Middle East & Africa", ug: "Middle East & Africa", uga: "Middle East & Africa", tz: "Middle East & Africa", tza: "Middle East & Africa", rw: "Middle East & Africa", rwa: "Middle East & Africa", bi: "Middle East & Africa", bdi: "Middle East & Africa", ng: "Middle East & Africa", nga: "Middle East & Africa", gh: "Middle East & Africa", gha: "Middle East & Africa", ci: "Middle East & Africa", civ: "Middle East & Africa", sn: "Middle East & Africa", sen: "Middle East & Africa", ml: "Middle East & Africa", mli: "Middle East & Africa", bf: "Middle East & Africa", bfa: "Middle East & Africa", ne: "Middle East & Africa", ner: "Middle East & Africa", td: "Middle East & Africa", tcd: "Middle East & Africa", cm: "Middle East & Africa", cmr: "Middle East & Africa", cf: "Middle East & Africa", caf: "Middle East & Africa", cg: "Middle East & Africa", cog: "Middle East & Africa", cd: "Middle East & Africa", cod: "Middle East & Africa", ga: "Middle East & Africa", gab: "Middle East & Africa", gq: "Middle East & Africa", gnq: "Middle East & Africa", zm: "Middle East & Africa", zmb: "Middle East & Africa", zw: "Middle East & Africa", zwe: "Middle East & Africa", mw: "Middle East & Africa", mwi: "Middle East & Africa", mz: "Middle East & Africa", moz: "Middle East & Africa", mg: "Middle East & Africa", mdg: "Middle East & Africa", mu: "Middle East & Africa", mus: "Middle East & Africa", sc: "Middle East & Africa", syc: "Middle East & Africa", km: "Middle East & Africa", com: "Middle East & Africa", bw: "Middle East & Africa", bwa: "Middle East & Africa", na: "Middle East & Africa", nam: "Middle East & Africa", ls: "Middle East & Africa", lso: "Middle East & Africa", sz: "Middle East & Africa", swz: "Middle East & Africa", za: "Middle East & Africa", zaf: "Middle East & Africa", ao: "Middle East & Africa", ago: "Middle East & Africa", tg: "Middle East & Africa", tgo: "Middle East & Africa", bj: "Middle East & Africa", ben: "Middle East & Africa", sl: "Middle East & Africa", sle: "Middle East & Africa", lr: "Middle East & Africa", lbr: "Middle East & Africa", gn: "Middle East & Africa", gin: "Middle East & Africa", gw: "Middle East & Africa", gnb: "Middle East & Africa", gm: "Middle East & Africa", gmb: "Middle East & Africa", cv: "Middle East & Africa", cpv: "Middle East & Africa", st: "Middle East & Africa", stp: "Middle East & Africa", tr: "Middle East & Africa", tur: "Middle East & Africa",
  };
  if (isoMap[c]) return isoMap[c];

  const nameLists = {
    "North America": ["united states", "u.s.", "u.s.a", "canada", "mexico", "puerto rico", "guam", "virgin islands"],
    "Europe": ["united kingdom", "england", "scotland", "wales", "ireland", "northern ireland", "germany", "france", "spain", "italy", "portugal", "netherlands", "belgium", "luxembourg", "switzerland", "austria", "sweden", "norway", "denmark", "finland", "iceland", "poland", "czech", "czechia", "slovakia", "hungary", "romania", "bulgaria", "greece", "croatia", "slovenia", "serbia", "bosnia", "montenegro", "albania", "macedonia", "estonia", "latvia", "lithuania", "russia", "ukraine", "belarus", "moldova", "malta", "cyprus", "andorra", "monaco", "liechtenstein", "san marino", "vatican", "faroe islands", "gibraltar", "isle of man", "jersey", "guernsey"],
    "Asia-Pacific": ["japan", "china", "south korea", "north korea", "taiwan", "hong kong", "singapore", "malaysia", "thailand", "indonesia", "philippines", "vietnam", "cambodia", "laos", "myanmar", "burma", "brunei", "timor", "india", "pakistan", "bangladesh", "sri lanka", "nepal", "bhutan", "maldives", "australia", "new zealand", "fiji", "papua new guinea", "solomon islands", "vanuatu", "samoa", "tonga", "mongolia", "kazakhstan", "uzbekistan", "turkmenistan", "kyrgyzstan", "tajikistan", "afghanistan"],
    "Latin America": ["brazil", "argentina", "chile", "colombia", "peru", "venezuela", "ecuador", "bolivia", "paraguay", "uruguay", "guyana", "suriname", "cuba", "dominican republic", "haiti", "jamaica", "trinidad", "barbados", "bahamas", "grenada", "antigua", "dominica", "saint lucia", "saint vincent", "saint kitts", "belize", "costa rica", "el salvador", "guatemala", "honduras", "nicaragua", "panama", "curacao", "aruba", "cayman", "bermuda", "british virgin islands", "netherlands antilles"],
    "Middle East & Africa": ["saudi arabia", "uae", "united arab emirates", "qatar", "kuwait", "bahrain", "oman", "yemen", "jordan", "lebanon", "syria", "israel", "palestine", "gaza", "west bank", "egypt", "libya", "tunisia", "algeria", "morocco", "sudan", "south sudan", "ethiopia", "eritrea", "djibouti", "somalia", "kenya", "uganda", "tanzania", "rwanda", "burundi", "nigeria", "ghana", "ivory coast", "cote d'ivoire", "senegal", "mali", "burkina faso", "niger", "chad", "cameroon", "central african republic", "congo", "gabon", "equatorial guinea", "zambia", "zimbabwe", "malawi", "mozambique", "madagascar", "mauritius", "seychelles", "comoros", "botswana", "namibia", "lesotho", "eswatini", "swaziland", "south africa", "angola", "togo", "benin", "sierra leone", "liberia", "guinea", "guinea-bissau", "gambia", "cape verde", "sao tome", "turkey"],
  };
  for (const [region, names] of Object.entries(nameLists)) {
    if (names.some(n => c === n || c.includes(n))) return region;
  }
  return null;
}

// Maps common ISO-2 country codes to full names for the location string.
// Falls back to the raw value when the code isn't recognized.
const COUNTRY_CODE_TO_NAME = {
  US: "USA", CA: "Canada", GB: "United Kingdom", AU: "Australia", DE: "Germany",
  FR: "France", JP: "Japan", CN: "China", IN: "India", BR: "Brazil", MX: "Mexico",
  NL: "Netherlands", CH: "Switzerland", SE: "Sweden", NO: "Norway", DK: "Denmark",
  FI: "Finland", IE: "Ireland", IT: "Italy", ES: "Spain", PT: "Portugal", BE: "Belgium",
  AT: "Austria", SG: "Singapore", HK: "Hong Kong", KR: "South Korea", TW: "Taiwan",
  ZA: "South Africa", AE: "UAE", SA: "Saudi Arabia", IL: "Israel", LU: "Luxembourg",
  NZ: "New Zealand", CL: "Chile", AR: "Argentina", CO: "Colombia", PE: "Peru",
};

// Builds a concise location string (e.g. "Philadelphia, PA, USA")
// from a firm's headquarters address (or first address if none marked HQ).
// Returns null when the address lacks enough location data.
export function deriveLocationFromAddresses(addresses) {
  if (!addresses || addresses.length === 0) return null;
  const hq = addresses.find(a => a.is_headquarters) || addresses[0];
  const parts = [];
  if (hq.city) parts.push(hq.city);
  if (hq.state) parts.push(hq.state);
  if (hq.country) parts.push(COUNTRY_CODE_TO_NAME[hq.country] || hq.country);
  const result = parts.filter(Boolean).join(", ");
  return result || null;
}

// Derives a single geographic region from a list of firm addresses.
// Returns "Global" when addresses span multiple regions, a single region
// when all classified addresses agree, or null when no address can be classified.
export function deriveGeographicRegionFromAddresses(addresses) {
  if (!addresses || addresses.length === 0) return null;
  const regions = new Set();
  for (const addr of addresses) {
    const region = countryToGeographicRegion(addr.country);
    if (region) regions.add(region);
  }
  if (regions.size === 0) return null;
  if (regions.size === 1) return [...regions][0];
  return "Global";
}