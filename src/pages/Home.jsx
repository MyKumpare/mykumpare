import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Building, Search, Package, User, LayoutList, BarChart3, Wrench, LogIn, LogOut, LineChart, ChevronsDownUp, ChevronsUpDown, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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
import AddBenchmarkDialog from "../components/utility/AddBenchmarkDialog";
import AnalyticsSection from "../components/analytics/AnalyticsSection";
import EditAnalysisDialog from "../components/analytics/EditAnalysisDialog";
import GlobalActivityLogModal from "../components/activity/GlobalActivityLogModal";
import PortfolioPickerModal from "../components/portfolios/PortfolioPickerModal";
import FirmPickerModal from "../components/firms/FirmPickerModal";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function Home() {
  const { isAuthenticated, user, navigateToLogin, logout } = useAuth();
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

  const portfoliosRef = useRef(null);
  const firmsRef = useRef(null);
  const productsRef = useRef(null);
  const contactsRef = useRef(null);
  const analyticsRef = useRef(null);
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
    queryFn: () => base44.entities.Contact.list("-created_date"),
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

  const deletedCount = deletedFirms.length + deletedProducts.length + deletedContacts.length + deletedPortfolios.length;



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
    mutationFn: (data) => base44.entities.Firm.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Firm.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      setDialogOpen(false);
      setEditingFirm(null);
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
    setReturnToProduct(fromProduct);
    setReturnToContactFromFirm(fromContact);
    if (fromProduct) setProductDialogOpen(false);
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
    { label: "Products", icon: Package, ref: productsRef, color: "text-violet-600", activeBg: "bg-violet-50" },
    { label: "Contacts", icon: User, ref: contactsRef, color: "text-pink-600", activeBg: "bg-pink-50" },
    { label: "Activity", icon: ClipboardList, ref: null, color: "text-amber-600", activeBg: "bg-amber-50", onClick: () => { setActivityLogDefaultTab("activity"); setActivityLogModalOpen(true); } },
    { label: "Tasks", icon: LayoutList, ref: null, color: "text-orange-600", activeBg: "bg-orange-50", onClick: () => { setActivityLogDefaultTab("task"); setActivityLogModalOpen(true); } },
    { label: "Analytics", icon: LineChart, ref: analyticsRef, color: "text-cyan-600", activeBg: "bg-cyan-50", onClick: () => setAnalyticsLaunchOpen(true) },
    { label: "Utilities", icon: Wrench, ref: utilityRef, color: "text-gray-600", activeBg: "bg-gray-100" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-16 sm:pt-14 sm:pb-20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Building className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">MyKumpare</h1>
                {isAuthenticated && user?.email && (
                  <p className="text-xs text-white/60 mt-0.5">{user.email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Desktop-only section nav (bottom nav covers mobile) */}
              <div className="hidden sm:grid grid-cols-4 gap-1">
              {mobileNavItems.map(({ label, icon: NavIcon, ref, onClick }) => (
                <button key={label} onClick={() => onClick ? onClick() : scrollTo(ref)} title={label}
                  className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-white/15 transition-colors group">
                  <NavIcon className="w-4 h-4 text-white/80 group-hover:text-white" />
                  <span className="text-[10px] text-white/70 group-hover:text-white font-medium">{label}</span>
                </button>
              ))}
              </div>
              <button
                onClick={() => setAllExpanded(v => !v)}
                title={allExpanded ? "Collapse all" : "Expand all"}
                className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-white/15 transition-colors group"
              >
                {allExpanded
                  ? <ChevronsDownUp className="w-4 h-4 text-white/80 group-hover:text-white" />
                  : <ChevronsUpDown className="w-4 h-4 text-white/80 group-hover:text-white" />
                }
                <span className="text-[10px] text-white/70 group-hover:text-white font-medium">
                  {allExpanded ? "Collapse" : "Expand"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content — overlaps the header */}
      {/* pb-24 on mobile to clear the fixed bottom nav; sm:pb-0 on desktop */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-8 pb-24 sm:pb-0">
        {/* Sign-in prompt for unauthenticated users */}
        {!isAuthenticated && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
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
        {/* Search bar */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-4 sm:p-5 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search firms, products, contacts or analyses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              className="pl-10 h-11 bg-gray-50 border-gray-200"
            />
            {searchFocused && searchQuery.trim() && (
              <SearchResults
                query={searchQuery}
                firms={firms}
                products={products}
                contacts={contacts}
                portfolios={portfolios}
                analyses={analyses}
                onFirmClick={(firm) => { setSearchQuery(""); handleEdit(firm); }}
                onContactClick={(contact) => { setSearchQuery(""); setViewingContact(contact); }}
                onProductClick={(product) => { setSearchQuery(""); handleEditProduct(product); }}
                onPortfolioClick={(portfolio) => { setSearchQuery(""); setPreselectedAllocatorId(portfolio.firm_id); setPortfolioDialogOpen(true); }}
                onAnalysisClick={(analysis) => { setSearchQuery(""); setEditingAnalysis(analysis); }}
              />
            )}
          </div>
        </div>

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
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingFirm(null);
            setPreselectedType(null);
            setOwnershipNavTarget(null);
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
        defaultTab={ownershipNavTarget ? "ownership" : undefined}
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
        onOpenChange={(open) => !open && !productDialogOpen && !dialogOpen && setViewingContact(null)}
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

      {/* Benchmark dialog */}
      <AddBenchmarkDialog
        open={benchmarkDialogOpen}
        onOpenChange={(o) => { if (!o) setEditingBenchmark(null); setBenchmarkDialogOpen(o); }}
        benchmarks={benchmarks}
        editingBenchmark={editingBenchmark}
      />

    </div>
  );
}