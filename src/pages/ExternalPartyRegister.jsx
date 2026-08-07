import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, CheckCircle2, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Hon."];
const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "Esq.", "CFA", "CPA", "MBA", "PhD", "MD"];
const FIRM_TYPES = ["Investment Manager", "Allocator", "Investment Consultant", "Securities Brokerage", "Trade Organization"];
const COUNTRY_CODES = [
  { code: "1", flag: "🇺🇸", country: "United States" },
  { code: "1", flag: "🇨🇦", country: "Canada" },
  { code: "44", flag: "🇬🇧", country: "United Kingdom" },
  { code: "33", flag: "🇫🇷", country: "France" },
  { code: "49", flag: "🇩🇪", country: "Germany" },
  { code: "81", flag: "🇯🇵", country: "Japan" },
  { code: "86", flag: "🇨🇳", country: "China" },
  { code: "91", flag: "🇮🇳", country: "India" },
  { code: "61", flag: "🇦🇺", country: "Australia" },
  { code: "65", flag: "🇸🇬", country: "Singapore" },
];

const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export default function ExternalPartyRegister() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    firm_name: "", firm_types: [], salutation: "",
    first_name: "", middle_name: "", last_name: "", suffix: "",
    email: "",
    country_code: "1", area_code: "", number_mid: "", number_last: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const setName = (field, val) => setForm((f) => ({ ...f, [field]: cap(val) }));

  // Pre-populate from the invitation link query params, or fall back to the
  // logged-in user's most recent external-party pending invitation.
  useEffect(() => {
    const firm = searchParams.get("firm") || "";
    const first = searchParams.get("first") || "";
    const middle = searchParams.get("middle") || "";
    const last = searchParams.get("last") || "";
    const email = searchParams.get("email") || "";
    const salutation = searchParams.get("salutation") || "";
    const suffix = searchParams.get("suffix") || "";
    const typesParam = searchParams.get("types") || "";
    const types = typesParam
      ? typesParam.split(",").map((t) => t.trim()).filter((t) => FIRM_TYPES.includes(t))
      : [];

    if (firm || first || last || email) {
      setForm((f) => ({
        ...f,
        firm_name: firm || f.firm_name,
        firm_types: types.length ? types : f.firm_types,
        first_name: first || f.first_name,
        middle_name: middle || f.middle_name,
        last_name: last || f.last_name,
        email: email || f.email,
        salutation: salutation || f.salutation,
        suffix: suffix || f.suffix,
      }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed || cancelled) return;
        const me = await base44.auth.me();
        if (!me?.email || cancelled) return;
        const invitations = await base44.entities.PendingInvitation.filter(
          { email: me.email, invitation_type: "external_party" },
          "-created_date",
          5
        );
        if (cancelled || !invitations.length) return;
        const inv = invitations[0];
        setForm((f) => ({
          ...f,
          firm_name: inv.firm_name || f.firm_name,
          first_name: inv.first_name || f.first_name,
          last_name: inv.last_name || f.last_name,
          email: me.email || f.email,
        }));
      } catch {
        // not logged in or no invitation — leave the form blank
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  const toggleFirmType = (type) => {
    setForm((f) => ({
      ...f,
      firm_types: f.firm_types.includes(type)
        ? f.firm_types.filter((t) => t !== type)
        : [...f.firm_types, type],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.firm_name.trim() || !form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.firm_types.length === 0) {
      setError("Please select at least one firm type.");
      return;
    }

    setSubmitting(true);
    try {
      const phone = (form.area_code && form.number_mid && form.number_last) ? {
        country_code: form.country_code,
        area_code: form.area_code,
        number_mid: form.number_mid,
        number_last: form.number_last,
        phone_type: "Office",
      } : undefined;

      const res = await base44.functions.invoke("registerExternalParty", {
        firm_name: form.firm_name,
        firm_types: form.firm_types,
        salutation: form.salutation || undefined,
        first_name: form.first_name,
        middle_name: form.middle_name || undefined,
        last_name: form.last_name,
        suffix: form.suffix || undefined,
        email: form.email,
        phone,
      });

      setResult(res);
    } catch (err) {
      setError(err?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Registration Submitted!</h1>
          <p className="text-sm text-gray-600 mb-4">
            Thank you, {form.first_name}! Your request to access the portal for{" "}
            <span className="font-semibold">{form.firm_name}</span> has been submitted.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Our team will review your request and send an email invitation to{" "}
            <span className="font-medium text-gray-600">{form.email}</span> once approved.
            {result.is_first_user && " You will be the default administrator for your firm."}
          </p>
          {result.firm_match && (
            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              Your firm name matches an existing record. Our admin will verify and link your account.
            </div>
          )}
          <Link to="/">
            <Button variant="outline" className="h-9 text-sm">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold">External Party Registration</h1>
            <p className="text-[11px] text-white/60">Request access to the firm portal</p>
          </div>
          <Link to="/" className="ml-auto text-xs text-white/70 hover:text-white">
            ← Back to app
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Firm Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-1.5">Firm Information</h2>

            <div>
              <Label className="text-xs font-medium text-gray-600">Firm Name *</Label>
              <Input
                className="h-9 mt-1"
                placeholder="Enter firm name"
                value={form.firm_name}
                onChange={(e) => set("firm_name", e.target.value)}
                required
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-600">Firm Type * (select all that apply)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {FIRM_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleFirmType(type)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      form.firm_types.includes(type)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-1.5">Contact Person</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">Salutation</Label>
                <Select value={form.salutation} onValueChange={(v) => set("salutation", v)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {SALUTATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Suffix</Label>
                <Select value={form.suffix} onValueChange={(v) => set("suffix", v)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {SUFFIXES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">First Name *</Label>
                <Input className="h-9 mt-1" placeholder="John" value={form.first_name}
                  onChange={(e) => setName("first_name", e.target.value)} required />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Middle Name</Label>
                <Input className="h-9 mt-1" placeholder="Robert" value={form.middle_name}
                  onChange={(e) => setName("middle_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Last Name *</Label>
                <Input className="h-9 mt-1" placeholder="Smith" value={form.last_name}
                  onChange={(e) => setName("last_name", e.target.value)} required />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-600">Email Address *</Label>
              <Input className="h-9 mt-1" type="email" placeholder="john.smith@firm.com" value={form.email}
                onChange={(e) => set("email", e.target.value.toLowerCase())} required />
            </div>

            {/* Phone */}
            <div>
              <Label className="text-xs font-medium text-gray-600">Phone Number</Label>
              <div className="flex items-center gap-2 mt-1">
                <Select value={form.country_code} onValueChange={(v) => set("country_code", v)}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c, i) => (
                      <SelectItem key={i} value={c.code}>{c.flag} +{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input className="h-9 w-20 text-center" placeholder="Area" maxLength={3}
                  value={form.area_code} onChange={(e) => set("area_code", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                <Input className="h-9 w-20 text-center" placeholder="000" maxLength={3}
                  value={form.number_mid} onChange={(e) => set("number_mid", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                <span className="text-gray-400">–</span>
                <Input className="h-9 w-24 text-center" placeholder="0000" maxLength={4}
                  value={form.number_last} onChange={(e) => set("number_last", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Link to="/">
              <Button type="button" variant="outline" className="h-9 text-sm">Cancel</Button>
            </Link>
            <Button type="submit" className="h-9 text-sm" disabled={submitting}>
              {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</> : "Submit Registration"}
            </Button>
          </div>
        </form>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          Your registration will be reviewed by our admin team. Once approved, you'll receive an email invitation.
        </p>
      </div>
    </div>
  );
}