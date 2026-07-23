import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Building, Search, Package, User, LayoutList, BarChart3, Wrench, LogIn, LogOut, LineChart, ChevronsDownUp, ChevronsUpDown, ClipboardList, FileText, Files } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import AIAssistant from "@/components/ai/AIAssistant";
import { parsePhoneString } from "@/components/ai/firmEnrichment";
import { detectDesignations } from "@/components/contacts/designationDetector";
import { toast } from "@/components/ui/use-toast";

import AddFirmDialog from "../components/firms/AddFirmDialog";
import DeleteConfirmDialog from "../components/firms/DeleteConfirmDialog";
import DeleteProductConfirmDialog from "../components/products/DeleteProductConfirmDialog";
import AddProductDialog from "../components/products/AddProductDialog";
import StatsListModal from "../components/stats/StatsListModal";
import ContactsListModal from "../components/contacts/ContactsListModal";
import AddContactDialog from "../components/contacts/AddContactDialog";
import SearchResults from "../components/search/SearchResults";
import AddPortfolioDialog from "../components/portfolios/AddPortfolioDialog";
import PortfoliosSection from "../components/portfolios/PortfoliosSection";
import FirmsSection from "../components/firms/FirmsSection";
import ProductsSection from "../components/products/ProductsSection";
import ContactsSection from "../components/contacts/ContactsSection";
import UtilitySection from "../components/utility/UtilitySection";
import ReportsSection from "../components/reports/ReportsSection";
import ReportsPickerModal from "../components/reports/ReportsPickerModal";
import DocumentsDashboardModal from "../components/firms/DocumentsDashboardModal";
import AddBenchmarkDialog from "../components/utility/AddBenchmarkDialog";
import AnalyticsSection from "../components/analytics/AnalyticsSection";
import EditAnalysisDialog from "../components/analytics/EditAnalysisDialog";
import GlobalActivityLogModal from "../components/activity/GlobalActivityLogModal";
import PortfolioPickerModal from "../components/portfolios/PortfolioPickerModal";
import FirmPickerModal from "../components/firms/FirmPickerModal";
import ProductPickerModal from "../components/products/ProductPickerModal";
import ContactPickerModal from "../components/contacts/ContactPickerModal";
import ActivityLogPickerModal from "../components/activity/ActivityLogPickerModal";
import ActivityDetailModal from "../components/activity/ActivityDetailModal";
import FollowUpTaskPickerModal from "../components/activity/FollowUpTaskPickerModal";
import TaskDetailModal from "../components/activity/TaskDetailModal";
import UserProfileDialog from "../components/user/UserProfileDialog";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function Home() {
  const { isAuthenticated, user, navigateToLogin, logout, updateUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState(null);
  const [preselectedType, setPreselectedType] = useState(null);
  const [deletingFirm, setDeletingFirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statsModal, setStatsModal] = useState(null); // "firms" | "products" | "portfolios" | null
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [viewingContact, setViewingContact] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [ownershipNavTarget, setOwnershipNavTarget] = useState(null); // { firmId, ownershipId }
  const [documentsNavTarget, setDocumentsNavTarget] = useState(null); // firmId to open at Documents tab

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [preselectedProductType, setPreselectedProductType] = useState(null);
  const [preselectedFirmId, setPreselectedFirmId] = useState(null);
  const [returnToProduct, setReturnToProduct] = useState(false); // track if firm was opened from product
  const [returnToContact, setReturnToContact] = useState(false); // track if product was opened from contact
  const [returnToContactFromFirm, setReturnToContactFromFirm] = useState(false); // track if firm was opened from contact
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [preselectedAllocatorId, setPreselectedAllocatorId] = useState(null);
  const [editingPortfolio, setEditingPortfolio] = useState(null);

  const [analyticsLaunchOpen, setAnalyticsLaunchOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState(null);
  const [analyticsReturnState, setAnalyticsReturnState] = useState(null); // { type: 'product'|'firm'|'benchmark', data: ... }
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState(null);
  const [activityLogModalOpen, setActivityLogModalOpen] = useState(false);
  const [activityLogDefaultTab, setActivityLogDefaultTab] = useState("activity");
  const [portfolioPickerOpen, setPortfolioPickerOpen] = useState(false);
  const [firmPickerOpen, setFirmPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [returnToActivity, setReturnToActivity] = useState(null); // activity to reopen when contact closes
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState(null);
  const [reportsPickerOpen, setReportsPickerOpen] = useState(false);
  const [documentsPickerOpen, setDocumentsPickerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const portfoliosRef = useRef(null);
  const firmsRef = useRef(null);
  const productsRef = useRef(null);
  const contactsRef = useRef(null);
  const analyticsRef = useRef(null);
  const reportsRef = useRef(null);
  const utilityRef = useRef(null);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const queryClient = useQueryClient();

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { data: portfolios = [] } = useQuery({
    queryKey: ["portfolios"],
    queryFn: () => base44.entities.Portfolio.list("-created_date"),
  });

  const { data: deletedFirms = [] } = useQuery({
    queryKey: ["deletedFirms"],
    queryFn: () => base44.entities.Firm.filter({ deleted_at: { $exists: true } }),
  });

  const { data: deletedProducts = [] } = useQuery({
    queryKey: ["deletedProducts"],
    queryFn: () => base44.entities.Product.filter({ deleted_at: { $exists: true } }),
  });

  const { data: deletedContacts = [] } = useQuery({
    queryKey: ["deletedContacts"],
    queryFn: () => base44.entities.Contact.filter({ deleted_at: { $exists: true } }),
  });

  const { data: deletedPortfolios = [] } = useQuery({
    queryKey: ["deletedPortfolios"],
    queryFn: () => base44.entities.Portfolio.filter({ deleted_at: { $exists: true } }),
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => base44.entities.Analysis.list("-created_date"),
  });

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["contact_activities_search"],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date"),
  });

  const { data: followUpTasks = [] } = useQuery({
    queryKey: ["follow_up_tasks_search"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date"),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["firm_documents_search"],
    queryFn: () => base44.entities.FirmDocument.list("-entry_date", 1000),
  });

  const deletedCount = deletedFirms.length + deletedProducts.length + deletedContacts.length + deletedPortfolios.length;

  // Realtime sync: keep every signed-in client in sync so an update made by one
  // account (e.g. "cgonzales") is immediately visible to others (e.g. the admin
  // "cjgonzales72"). On any create/update/delete event for a tracked entity,
  // invalidate its cached query so React Query refetches the latest data.
  useEffect(() => {
    const invalidate = (keys) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
    const subs = [
      base44.entities.Firm.subscribe(() => invalidate([["firms"], ["deletedFirms"]])),
      base44.entities.Product.subscribe(() => invalidate([["products"], ["deletedProducts"]])),
      base44.entities.Contact.subscribe(() => invalidate([["contacts"], ["deletedContacts"]])),
      base44.entities.Portfolio.subscribe(() => invalidate([["portfolios"], ["deletedPortfolios"]])),
      base44.entities.ContactActivity.subscribe(() => invalidate([["contact_activities_search"]])),
      base44.entities.FollowUpTask.subscribe(() => invalidate([["follow_up_tasks_search"]])),
      base44.entities.FirmDocument.subscribe(() => invalidate([["firm_documents_search"]])),
      base44.entities.Analysis.subscribe(() => invalidate([["analyses"]])),
      base44.entities.Benchmark.subscribe(() => invalidate([["benchmarks"]])),
    ];
    return () => subs.forEach((unsub) => unsub && unsub());
  }, [queryClient]);

  // Resolve the signed-in user's contact: prefer the explicitly linked record,
  // fall back to an email match. Used for the header photo + display name.
  const linkedContact = user?.linked_contact_id
    ? contacts.find(c => c.id === user.linked_contact_id && !c.deleted_at)
    : null;
  const emailContact = user?.email
    ? contacts.find(c => !c.deleted_at && (c.email || "").toLowerCase() === user.email.toLowerCase())
    : null;
  const myContact = linkedContact || emailContact;
  const userPhoto = myContact?.photo_url;

  const handleSaveProfileLink = async ({ linked_firm_id, linked_contact_id }) => {
    await updateUser({ linked_firm_id, linked_contact_id });
    toast({ title: "Profile updated", description: "Your firm & contact link have been saved." });
  };
  const userDisplayName = user?.full_name || (myContact ? [myContact.first_name, myContact.last_name].filter(Boolean).join(" ") : "") || "";
  const userContactFullName = myContact
    ? [myContact.salutation, myContact.first_name, myContact.middle_name, myContact.last_name, myContact.suffix].filter(Boolean).join(" ")
    : "";



  const createProductMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setProductDialogOpen(false);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setProductDialogOpen(false);
      setEditingProduct(null);
    },
    onError: (err) => {
      console.error("Product update failed:", err);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeletingProduct(null);
    },
  });

  const handleProductSubmit = (data) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { pending_contacts, ...firmData } = data;
      const firm = await base44.entities.Firm.create(firmData);
      if (pending_contacts?.length) {
        for (const person of pending_contacts) {
          const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
          const designations = person.designations?.length > 0
            ? person.designations
            : detectDesignations(fullName, person.biography);
          const contactData = {
            first_name: person.first_name || "",
            last_name: person.last_name || "",
            title: person.title || "",
            email: person.email || "",
            linkedin_url: person.linkedin_url || "",
            biography: person.biography || "",
            photo_url: person.photo_url || "",
            firm_ids: [firm.id],
          };
          if (designations.length > 0) contactData.designations = designations;
          const parsedPhone = person.phone ? parsePhoneString(person.phone) : null;
          if (parsedPhone) contactData.phones = [parsedPhone];
          try { await base44.entities.Contact.create(contactData); } catch {}
        }
      }
      return firm;
    },
    onSuccess: (createdFirm) => {
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      // Keep the dialog open and switch to view mode after creating a firm
      // (instead of closing it). Setting editingFirm to the newly-created firm
      // object makes AddFirmDialog's init effect re-run, re-initializing the
      // form from the saved values and setting isEditing=false → view mode.
      setEditingFirm(createdFirm);
    },
    onError: (err) => {
      toast({ title: "Failed to create firm", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Firm.update(id, data),
    onSuccess: (updatedFirm) => {
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      // Keep the dialog open and switch to view mode after a successful save
      // (instead of closing it). Setting editingFirm to the freshly-saved firm
      // object (a new ref) makes AddFirmDialog's init effect re-run, which
      // re-initializes the form from the saved values and sets isEditing=false
      // → view mode. The dialog stays open so the user can review the result.
      setEditingFirm(updatedFirm);
    },
    onError: (err) => {
      // Keep the dialog open with the user's data intact (form is no longer
      // cleared on submit) so they can fix the issue and retry.
      toast({ title: "Failed to save firm", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Firm.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      setDeletingFirm(null);
    },
  });

  const handleSubmit = (data) => {
    if (editingFirm) {
      updateMutation.mutate({ id: editingFirm.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleNavigateToOwnership = (firmId, ownershipId) => {
    const firm = firms.find(f => f.id === firmId);
    if (!firm) return;
    setOwnershipNavTarget({ firmId, ownershipId });
    setEditingFirm(firm);
    setPreselectedType(null);
    setDialogOpen(true);
  };

  const handleEdit = (firm, fromProduct = false, fromContact = false) => {
    setEditingFirm(firm);
    setPreselectedType(null);
    setOwnershipNavTarget(null);
    setDocumentsNavTarget(null);
    setReturnToProduct(fromProduct);
    setReturnToContactFromFirm(fromContact);
    if (fromProduct) setProductDialogOpen(false);
    setDialogOpen(true);
  };

  const handleDocumentClick = (doc) => {
    const firm = firms.find((f) => f.id === doc.firm_id);
    if (!firm) return;
    setEditingFirm(firm);
    setPreselectedType(null);
    setOwnershipNavTarget(null);
    setDocumentsNavTarget(firm.id);
    setDialogOpen(true);
  };

  const handleAddToType = (type) => {
    setEditingFirm(null);
    setPreselectedType(type);
    setDialogOpen(true);
  };

  const handleAddProductFromFirm = (firm, productType) => {
    setEditingProduct(null);
    setPreselectedProductType(productType);
    setPreselectedFirmId(firm.id);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (product, fromContact = false) => {
    setEditingProduct(product);
    setPreselectedProductType(null);
    setPreselectedFirmId(null);
    setReturnToContact(fromContact);
    if (fromContact) {
      setViewingContact(prev => prev); // keep viewingContact set so we can restore it
    }
    setProductDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingFirm) {
      // Soft delete: set deleted_at timestamp
      updateMutation.mutate({ 
        id: deletingFirm.id, 
        data: { deleted_at: new Date().toISOString() } 
      });
    }
  };

  const handleDeleteProductConfirm = () => {
    if (deletingProduct) {
      updateProductMutation.mutate({
        id: deletingProduct.id,
        data: { deleted_at: new Date().toISOString() },
      });
      setDeletingProduct(null);
    }
  };

  const q = searchQuery.toLowerCase();

  // Firms that match by name, OR have a matching product, OR have a matching contact
  // Exclude soft-deleted firms
  const activeFirms = firms.filter(f => !f.deleted_at);
  const activeProducts = products.filter(p => !p.deleted_at);
  const activeContacts = contacts.filter(c => !c.deleted_at);
  
  const matchingProductFirmIds = q
    ? new Set(activeProducts.filter((p) => p.name.toLowerCase().includes(q)).map((p) => p.firm_id))
    : new Set();

  const matchingContactFirmIds = q
    ? new Set(
        activeContacts
          .filter(c => {
            const fullName = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ").toLowerCase();
            return fullName.includes(q) || (c.email || "").toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q);
          })
          .flatMap(c => c.firm_ids || [])
      )
    : new Set();

  const filteredFirms = activeFirms.filter((f) =>
    f.name.toLowerCase().includes(q) || matchingProductFirmIds.has(f.id) || matchingContactFirmIds.has(f.id)
  );

  const getFirmTypes = (f) =>
    f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

  const groupedFirms = FIRM_TYPES.reduce((acc, type) => {
    const typeFirms = filteredFirms
      .filter((f) => getFirmTypes(f).includes(type))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (typeFirms.length > 0) acc[type] = typeFirms;
    return acc;
  }, {});

  const totalFirms = activeFirms.length;
  const totalProducts = activeProducts.length;
  const totalContacts = activeContacts.length;
  const totalPortfolios = portfolios.filter(p => !p.deleted_at).length;
  const totalAnalyses = analyses.length;
  const hasResults = Object.keys(groupedFirms).length > 0;

  const mobileNavItems = [
    { label: "Portfolios", icon: BarChart3, ref: null, color: "text-emerald-600", activeBg: "bg-emerald-50", onClick: () => setPortfolioPickerOpen(true) },
    { label: "Firms", icon: Building, ref: null, color: "text-indigo-600", activeBg: "bg-indigo-50", onClick: () => setFirmPickerOpen(true) },
    { label: "Products", icon: Package, ref: null, color: "text-violet-600", activeBg: "bg-violet-50", onClick: () => setProductPickerOpen(true) },
    { label: "Contacts", icon: User, ref: null, color: "text-pink-600", activeBg: "bg-pink-50", onClick: () => setContactPickerOpen(true) },
    { label: "Activity", icon: ClipboardList, ref: null, color: "text-amber-600", activeBg: "bg-amber-50", onClick: () => setActivityPickerOpen(true) },
    { label: "Tasks", icon: LayoutList, ref: null, color: "text-orange-600", activeBg: "bg-orange-50", onClick: () => setTaskPickerOpen(true) },
    { label: "Analytics", icon: LineChart, ref: analyticsRef, color: "text-cyan-600", activeBg: "bg-cyan-50", onClick: () => setAnalyticsLaunchOpen(true) },
    { label: "Reports", icon: FileText, ref: reportsRef, color: "text-blue-600", activeBg: "bg-blue-50", onClick: () => setReportsPickerOpen(true) },
    { label: "Documents", icon: Files, ref: null, color: "text-teal-600", activeBg: "bg-teal-50", onClick: () => setDocumentsPickerOpen(true) },
    { label: "Utilities", icon: Wrench, ref: utilityRef, color: "text-gray-600", activeBg: "bg-gray-100" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/80 flex flex-col">
      {/* Compact top bar */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
          {/* Logo + title */}
          <div className="flex items-center gap-2 mr-3 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Building className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight hidden sm:block">MyKumpare</span>
          </div>

          {/* Search bar inline in header */}
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
            <input
              type="text"
              placeholder="Search firms, products, contacts, documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              className="w-full pl-9 pr-3 h-8 rounded-lg bg-white/15 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:bg-white/25 focus:border-white/40 transition-colors"
            />
            {searchFocused && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50">
                <SearchResults
                  query={searchQuery}
                  firms={firms}
                  products={products}
                  contacts={contacts}
                  portfolios={portfolios}
                  analyses={analyses}
                  activities={activities}
                  followUpTasks={followUpTasks}
                  documents={documents}
                  onFirmClick={(firm) => { setSearchQuery(""); handleEdit(firm); }}
                  onContactClick={(contact) => { setSearchQuery(""); setViewingContact(contact); }}
                  onProductClick={(product) => { setSearchQuery(""); handleEditProduct(product); }}
                  onPortfolioClick={(portfolio) => { setSearchQuery(""); setPreselectedAllocatorId(portfolio.firm_id); setPortfolioDialogOpen(true); }}
                  onAnalysisClick={(analysis) => { setSearchQuery(""); setEditingAnalysis(analysis); }}
                  onActivityClick={(activity) => { setSearchQuery(""); setViewingActivity(activity); }}
                  onTaskClick={(task) => { setSearchQuery(""); setViewingTask(task); }}
                  onDocumentClick={(doc) => { setSearchQuery(""); handleDocumentClick(doc); }}
                />
              </div>
            )}
          </div>

          {/* Desktop nav — single row of icon buttons */}
          <div className="hidden sm:flex items-center gap-0.5 ml-2">
            {mobileNavItems.map(({ label, icon: NavIcon, ref, onClick }) => (
              <button key={label} onClick={() => onClick ? onClick() : scrollTo(ref)} title={label}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white/15 transition-colors group">
                <NavIcon className="w-4 h-4 text-white/80 group-hover:text-white" />
                <span className="text-[9px] text-white/70 group-hover:text-white font-medium leading-none">{label}</span>
              </button>
            ))}
            <button
              onClick={() => setAllExpanded(v => !v)}
              title={allExpanded ? "Collapse all" : "Expand all"}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white/15 transition-colors group ml-1 border-l border-white/20 pl-2"
            >
              {allExpanded
                ? <ChevronsDownUp className="w-4 h-4 text-white/80 group-hover:text-white" />
                : <ChevronsUpDown className="w-4 h-4 text-white/80 group-hover:text-white" />
              }
              <span className="text-[9px] text-white/70 group-hover:text-white font-medium leading-none">
                {allExpanded ? "Collapse" : "Expand"}
              </span>
            </button>
          </div>

          {/* Signed-in user: click to open profile (logout + firm/contact link) */}
          {isAuthenticated && user?.email && (
            <>
              <button
                onClick={() => setProfileOpen(true)}
                title="My profile"
                className="hidden lg:flex items-center gap-2 ml-2 flex-shrink-0 rounded-lg px-2 py-1 hover:bg-white/15 transition-colors text-left"
              >
                {userPhoto ? (
                  <img src={userPhoto} alt="" className="w-7 h-7 rounded-full object-cover border border-white/30" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white border border-white/30">
                    {(userDisplayName || user.email).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col leading-tight">
                  {userDisplayName && <span className="text-[11px] text-white/90 font-medium">{userDisplayName}</span>}
                  <span className="text-[10px] text-white/50">{userContactFullName || user.email}</span>
                </div>
              </button>
              <button
                onClick={() => setProfileOpen(true)}
                title="My profile"
                className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-white/20 border border-white/30 ml-1 shrink-0"
              >
                {userPhoto ? (
                  <img src={userPhoto} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-white">{(userDisplayName || user.email).slice(0, 2).toUpperCase()}</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content — full width below header */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 pb-24 sm:pb-4">
        {/* Sign-in prompt for unauthenticated users */}
        {!isAuthenticated && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-800">Sign in to view and manage your data.</p>
            <button
              onClick={() => navigateToLogin()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          </div>
        )}
        {/* Portfolios section */}
        <div ref={portfoliosRef} />
        <PortfoliosSection
          portfolios={portfolios.filter(p => !p.deleted_at)}
          onPortfolioClick={(portfolio) => { setEditingPortfolio(portfolio); setPreselectedAllocatorId(null); setPortfolioDialogOpen(true); }}
          onAddPortfolio={() => { setEditingPortfolio(null); setPreselectedAllocatorId(null); setPortfolioDialogOpen(true); }}
          forceExpanded={allExpanded}
        />

        {/* Firms section */}
        <div ref={firmsRef} />
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <FirmsSection
            groupedFirms={groupedFirms}
            totalFirms={totalFirms}
            products={activeProducts}
            searchQuery={searchQuery}
            onEdit={handleEdit}
            onDelete={setDeletingFirm}
            onAddToType={handleAddToType}
            onAddFirm={() => { setEditingFirm(null); setPreselectedType(null); setDialogOpen(true); }}
            onAddProduct={handleAddProductFromFirm}
            onEditProduct={handleEditProduct}
            onAddPortfolio={(firm) => { setPreselectedAllocatorId(firm.id); setPortfolioDialogOpen(true); }}
            forceExpanded={allExpanded}
          />
        )}

        {/* Products section */}
        <div ref={productsRef} />
        <ProductsSection
          products={activeProducts}
          firms={activeFirms}
          onProductClick={handleEditProduct}
          onFirmClick={(firm) => handleEdit(firm)}
          onAddProduct={() => { setEditingProduct(null); setPreselectedProductType(null); setPreselectedFirmId(null); setProductDialogOpen(true); }}
          forceExpanded={allExpanded}
        />

        {/* Contacts section */}
        <div ref={contactsRef} />
        <ContactsSection
          contacts={activeContacts}
          firms={activeFirms}
          onContactClick={(contact) => setViewingContact(contact)}
          onFirmClick={(firm) => handleEdit(firm, false, false)}
          onAddContact={() => setAddContactOpen(true)}
          forceExpanded={allExpanded}
        />

        {/* Analytics section */}
        <div ref={analyticsRef} />
        <AnalyticsSection
          openLaunch={analyticsLaunchOpen}
          onLaunchOpenChange={setAnalyticsLaunchOpen}
          totalAnalyses={totalAnalyses}
          forceExpanded={allExpanded}
          editingAnalysis={editingAnalysis}
          onEditAnalysisChange={setEditingAnalysis}
          onProductClick={(product) => {
            setAnalyticsReturnState({ type: 'product', product });
            handleEditProduct(product);
          }}
          onFirmClick={(firm) => {
            setAnalyticsReturnState({ type: 'firm', firm });
            handleEdit(firm);
          }}
          onBenchmarkClick={(benchmarkId) => {
            const bm = benchmarks.find(b => b.id === benchmarkId);
            if (bm) {
              setEditingBenchmark(bm);
              setBenchmarkDialogOpen(true);
            }
          }}
          onProductClick={(product) => {
            setAnalyticsReturnState({ type: 'product', product });
            handleEditProduct(product);
          }}
          onFirmClick={(firm) => {
            setAnalyticsReturnState({ type: 'firm', firm });
            handleEdit(firm);
          }}
        />

        {/* Reports section */}
        <div ref={reportsRef} />
        <ReportsSection forceExpanded={allExpanded} />

        {/* Utility section */}
        <div ref={utilityRef} />
        <UtilitySection deletedCount={deletedCount} />

        <div className="h-4" />
      </div>

      {/* ── Mobile bottom navigation (hidden on sm+ screens) ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
      >
        <div className="flex overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {mobileNavItems.map(({ label, icon: MobileIcon, color, ref, onClick }) => (
            <button
              key={label}
              onTouchEnd={(e) => { e.preventDefault(); onClick ? onClick() : scrollTo(ref); }}
              onClick={() => onClick ? onClick() : scrollTo(ref)}
              className="flex flex-col items-center gap-1 py-2.5 flex-shrink-0 transition-colors"
              style={{ minWidth: 72 }}
            >
              <MobileIcon className={`w-5 h-5 ${color}`} />
              <span className={`text-[10px] font-medium ${color}`}>{label}</span>
            </button>
          ))}
          <button
            onTouchEnd={(e) => { e.preventDefault(); setAllExpanded(v => !v); }}
            onClick={() => setAllExpanded(v => !v)}
            className="flex flex-col items-center gap-1 py-2.5 flex-shrink-0 transition-colors"
            style={{ minWidth: 72 }}
          >
            {allExpanded
              ? <ChevronsDownUp className="w-5 h-5 text-gray-500" />
              : <ChevronsUpDown className="w-5 h-5 text-gray-500" />
            }
            <span className="text-[10px] font-medium text-gray-500">
              {allExpanded ? "Collapse" : "Expand"}
            </span>
          </button>
        </div>
      </nav>

      <AddFirmDialog
        onProductClick={(product) => handleEditProduct(product, false)}
        onPortfolioClick={(portfolio) => { setDialogOpen(false); setEditingPortfolio(portfolio); setPreselectedAllocatorId(null); setPortfolioDialogOpen(true); }}
        onFirmClick={(f) => { const full = firms.find(x => x.id === f?.id) || f; if (full) handleEdit(full); }}
        onContactClick={(c) => { if (c) setViewingContact(c); }}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingFirm(null);
            setPreselectedType(null);
            setOwnershipNavTarget(null);
            setDocumentsNavTarget(null);
            if (returnToProduct) {
              setReturnToProduct(false);
              setProductDialogOpen(true);
            }
            if (returnToContactFromFirm) {
              setReturnToContactFromFirm(false);
              // viewingContact is still set, dialog reopens automatically
            }
          }
        }}
        onSubmit={handleSubmit}
        onDelete={setDeletingFirm}
        editingFirm={editingFirm}
        preselectedType={preselectedType}
        existingFirms={firms}
        defaultTab={ownershipNavTarget ? "ownership" : documentsNavTarget ? "documents" : undefined}
        defaultOwnershipId={ownershipNavTarget?.ownershipId}
      />

      <DeleteConfirmDialog
        open={!!deletingFirm}
        onOpenChange={(open) => !open && setDeletingFirm(null)}
        firm={deletingFirm}
        onConfirm={handleDeleteConfirm}
      />

      <DeleteProductConfirmDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        product={deletingProduct}
        onConfirm={handleDeleteProductConfirm}
      />

      <StatsListModal
        open={!!statsModal}
        onOpenChange={(open) => !open && setStatsModal(null)}
        mode={statsModal}
        firms={firms}
        products={products}
        portfolios={portfolios}
        onFirmClick={handleEdit}
        onProductClick={handleEditProduct}
        onPortfolioClick={(portfolio) => { setEditingPortfolio(portfolio); setPreselectedAllocatorId(null); setPortfolioDialogOpen(true); }}
      />

      <ContactsListModal
        open={contactsModalOpen}
        onOpenChange={setContactsModalOpen}
        contacts={contacts}
        firms={firms}
        onNavigateToOwnership={handleNavigateToOwnership}
        onProductClick={(product) => handleEditProduct(product, true)}
        onFirmClick={(firm) => firm && handleEdit(firm, false, true)}
      />

      <AddContactDialog
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        editingContact={null}
        currentFirmId={null}
        firms={firms}
      />

      <AddContactDialog
        open={!!viewingContact && !productDialogOpen && !dialogOpen}
        onOpenChange={(open) => {
          if (!open && !productDialogOpen && !dialogOpen) {
            setViewingContact(null);
            if (returnToActivity) {
              setViewingActivity(returnToActivity);
              setReturnToActivity(null);
            }
          }
        }}
        editingContact={viewingContact}
        firms={firms}
        viewMode={true}
        onNavigateToOwnership={handleNavigateToOwnership}
        onProductClick={(product) => handleEditProduct(product, true)}
        onFirmClick={(firm) => firm && handleEdit(firm, false, true)}
      />

      <AddPortfolioDialog
        open={portfolioDialogOpen}
        onOpenChange={(o) => { setPortfolioDialogOpen(o); if (!o) { setPreselectedAllocatorId(null); setEditingPortfolio(null); } }}
        preselectedAllocatorId={preselectedAllocatorId}
        editingPortfolio={editingPortfolio}
        onDelete={(portfolio) => {
          base44.entities.Portfolio.delete(portfolio.id).then(() => {
            queryClient.invalidateQueries({ queryKey: ["portfolios"] });
          });
        }}
        onFirmClick={handleEdit}
        onProductClick={handleEditProduct}
      />

      <AddProductDialog
        isSaving={updateProductMutation.isPending || createProductMutation.isPending}
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            setPreselectedProductType(null);
            setPreselectedFirmId(null);
            if (returnToContact) {
              setReturnToContact(false);
              // viewingContact is still set, so the dialog will re-open automatically
            }
          }
        }}
        onSubmit={handleProductSubmit}
        onDelete={(product) => {
          setDeletingProduct(product);
        }}
        editingProduct={editingProduct}
        firms={activeFirms}
        existingProducts={activeProducts}
        preselectedProductType={preselectedProductType}
        preselectedFirmId={preselectedFirmId}
        onFirmClick={(firm) => handleEdit(firm, true)}
      />

      {/* Edit/view/delete analysis dialog */}
      <EditAnalysisDialog
        open={!!editingAnalysis}
        onOpenChange={(o) => { if (!o) setEditingAnalysis(null); }}
        analysis={editingAnalysis}
      />

      <GlobalActivityLogModal
        open={activityLogModalOpen}
        onClose={() => setActivityLogModalOpen(false)}
        defaultTab={activityLogDefaultTab}
        onFirmClick={(f) => { setActivityLogModalOpen(false); const full = firms.find(x => x.id === f?.id) || f; if (full) handleEdit(full); }}
        onContactClick={(c) => { if (c) setViewingContact(c); }}
      />

      <PortfolioPickerModal
        open={portfolioPickerOpen}
        onClose={() => setPortfolioPickerOpen(false)}
        portfolios={portfolios}
        onPortfolioClick={(portfolio) => { setEditingPortfolio(portfolio); setPreselectedAllocatorId(null); setPortfolioDialogOpen(true); }}
        onAddPortfolio={() => { setEditingPortfolio(null); setPreselectedAllocatorId(null); setPortfolioDialogOpen(true); }}
      />

      <FirmPickerModal
        open={firmPickerOpen}
        onClose={() => setFirmPickerOpen(false)}
        firms={firms}
        onFirmClick={(firm) => handleEdit(firm)}
        onAddFirm={() => { setEditingFirm(null); setPreselectedType(null); setDialogOpen(true); }}
      />

      <ProductPickerModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        products={products}
        onProductClick={(product) => handleEditProduct(product)}
        onAddProduct={() => { setEditingProduct(null); setPreselectedProductType(null); setPreselectedFirmId(null); setProductDialogOpen(true); }}
      />

      <ContactPickerModal
        open={contactPickerOpen}
        onClose={() => setContactPickerOpen(false)}
        contacts={contacts}
        firms={firms}
        onContactClick={(contact) => setViewingContact(contact)}
        onAddContact={() => setAddContactOpen(true)}
      />

      <ActivityLogPickerModal
        open={activityPickerOpen}
        onClose={() => setActivityPickerOpen(false)}
        onAddActivity={() => { setActivityLogDefaultTab("activity"); setActivityLogModalOpen(true); }}
        onActivityClick={(activity) => setViewingActivity(activity)}
      />

      <ReportsPickerModal
        open={reportsPickerOpen}
        onClose={() => setReportsPickerOpen(false)}
      />

      <DocumentsDashboardModal
        open={documentsPickerOpen}
        onClose={() => setDocumentsPickerOpen(false)}
      />

      <ActivityDetailModal
        open={!!viewingActivity}
        activity={viewingActivity}
        onClose={() => setViewingActivity(null)}
        onOpenContact={(contact) => {
          setReturnToActivity(viewingActivity);
          setViewingActivity(null);
          setViewingContact(contact);
        }}
        onFirmClick={(firm) => {
          setViewingActivity(null);
          handleEdit(firm);
        }}
        onContactClick={(contact) => {
          setReturnToActivity(viewingActivity);
          setViewingActivity(null);
          setViewingContact(contact);
        }}
      />

      <FollowUpTaskPickerModal
        open={taskPickerOpen}
        onClose={() => setTaskPickerOpen(false)}
        onAddTask={() => { setActivityLogDefaultTab("task"); setActivityLogModalOpen(true); }}
        onTaskClick={(task) => setViewingTask(task)}
      />

      <TaskDetailModal
        open={!!viewingTask}
        task={viewingTask}
        onClose={() => setViewingTask(null)}
        onFirmClick={(firm) => {
          setViewingTask(null);
          handleEdit(firm);
        }}
        onContactClick={(contact) => {
          setViewingTask(null);
          setViewingContact(contact);
        }}
      />

      {/* Benchmark dialog */}
      <AddBenchmarkDialog
        open={benchmarkDialogOpen}
        onOpenChange={(o) => { if (!o) setEditingBenchmark(null); setBenchmarkDialogOpen(o); }}
        benchmarks={benchmarks}
        editingBenchmark={editingBenchmark}
      />

      {/* User profile: logout + firm/contact linking */}
      <UserProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        firms={firms}
        contacts={contacts}
        onSaveLinked={handleSaveProfileLink}
        onLogout={() => { setProfileOpen(false); logout(); }}
      />

      {/* AI Assistant */}
      <AIAssistant />
    </div>
  );
}