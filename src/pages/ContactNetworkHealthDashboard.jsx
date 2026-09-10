import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Network, AlertCircle, LayoutList, Building2 } from "lucide-react";
import ContactNetworkTable from "@/components/network/ContactNetworkTable";
import FirmRelationshipSummary from "@/components/network/FirmRelationshipSummary";

export default function ContactNetworkHealthDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [firms, setFirms] = useState([]);
  const [products, setProducts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [view, setView] = useState("contacts"); // contacts | firms

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [fRes, pRes, cRes] = await Promise.all([
          base44.functions.invoke("fetchAllFirms", {}),
          base44.functions.invoke("fetchAllProducts", {}),
          base44.functions.invoke("fetchAllContacts", {}),
        ]);
        setFirms(fRes?.records || []);
        setProducts(pRes?.records || []);
        setContacts(cRes?.records || []);
      } catch (err) {
        setError(err?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-gray-500">Loading relationship data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-2">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-destructive font-medium">Error loading dashboard</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  const activeFirms = firms.filter((f) => !f.deleted_at).length;
  const activeProducts = products.filter((p) => !p.deleted_at && p.product_availability_status === "Active").length;
  const activeContacts = contacts.filter((c) => !c.deleted_at && c.contact_status !== "Inactive").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Network className="w-6 h-6 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Contact Network Health Dashboard</h1>
            <p className="text-xs text-white/70">
              Relationship health check — contact coverage, firm AUM, and active products at a glance
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">Active Firms</p>
            <p className="text-2xl font-bold text-indigo-600">{activeFirms}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">Active Products</p>
            <p className="text-2xl font-bold text-green-600">{activeProducts}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">Active Contacts</p>
            <p className="text-2xl font-bold text-pink-600">{activeContacts}</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <button
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "contacts" ? "bg-primary text-primary-foreground" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
            onClick={() => setView("contacts")}
          >
            <LayoutList className="w-4 h-4" /> Contacts Table
          </button>
          <button
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "firms" ? "bg-primary text-primary-foreground" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
            onClick={() => setView("firms")}
          >
            <Building2 className="w-4 h-4" /> Firm Summary
          </button>
        </div>

        {view === "contacts" ? (
          <ContactNetworkTable contacts={contacts} firms={firms} />
        ) : (
          <FirmRelationshipSummary firms={firms} products={products} contacts={contacts} />
        )}
      </div>
    </div>
  );
}