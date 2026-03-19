import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Building, Search, Package, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import AddFirmDialog from "../components/firms/AddFirmDialog";
import FirmTypeSection from "../components/firms/FirmTypeSection";
import DeleteConfirmDialog from "../components/firms/DeleteConfirmDialog";
import AddProductDialog from "../components/products/AddProductDialog";
import StatsListModal from "../components/stats/StatsListModal";
import ContactsListModal from "../components/contacts/ContactsListModal";
import AddContactDialog from "../components/contacts/AddContactDialog";
import SearchResults from "../components/search/SearchResults";
import AddPortfolioDialog from "../components/portfolios/AddPortfolioDialog";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function Home() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState(null);
  const [preselectedType, setPreselectedType] = useState(null);
  const [deletingFirm, setDeletingFirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statsModal, setStatsModal] = useState(null); // "firms" | "products" | null
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
      deleteMutation.mutate(deletingFirm.id);
    }
  };

  const q = searchQuery.toLowerCase();

  // Firms that match by name, OR have a matching product, OR have a matching contact
  const matchingProductFirmIds = q
    ? new Set(products.filter((p) => p.name.toLowerCase().includes(q)).map((p) => p.firm_id))
    : new Set();

  const matchingContactFirmIds = q
    ? new Set(
        contacts
          .filter(c => {
            const fullName = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ").toLowerCase();
            return fullName.includes(q) || (c.email || "").toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q);
          })
          .flatMap(c => c.firm_ids || [])
      )
    : new Set();

  const filteredFirms = firms.filter((f) =>
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

  const totalFirms = firms.length;
  const totalProducts = products.length;
  const totalContacts = contacts.length;
  const hasResults = Object.keys(groupedFirms).length > 0;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-16 sm:pt-14 sm:pb-20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">MyKumpare</h1>
          </div>

          <div className="mt-6 flex items-center gap-6">
            <button
              onClick={() => setStatsModal("firms")}
              className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
            >
              <div className="text-3xl sm:text-4xl font-bold underline decoration-dotted underline-offset-4 decoration-indigo-300">{totalFirms}</div>
              <div className="text-indigo-200 text-sm leading-tight text-left group-hover:text-white transition-colors">
                Total<br />Firms
              </div>
            </button>
            <div className="w-px h-10 bg-white/20" />
            <button
              onClick={() => setStatsModal("products")}
              className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
            >
              <div className="text-3xl sm:text-4xl font-bold underline decoration-dotted underline-offset-4 decoration-violet-300">{totalProducts}</div>
              <div className="text-indigo-200 text-sm leading-tight text-left group-hover:text-white transition-colors">
                Total<br />Products
              </div>
            </button>
            <div className="w-px h-10 bg-white/20" />
            <button
              onClick={() => setContactsModalOpen(true)}
              className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
            >
              <div className="text-3xl sm:text-4xl font-bold underline decoration-dotted underline-offset-4 decoration-pink-300">{totalContacts}</div>
              <div className="text-indigo-200 text-sm leading-tight text-left group-hover:text-white transition-colors">
                Total<br />Contacts
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main content — overlaps the header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-8">
        {/* Action bar */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-4 sm:p-5 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search firms, products or contacts..."
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
                  onFirmClick={(firm) => { setSearchQuery(""); handleEdit(firm); }}
                  onContactClick={(contact) => { setSearchQuery(""); setViewingContact(contact); }}
                  onProductClick={(product) => { setSearchQuery(""); handleEditProduct(product); }}
                />
              )}
            </div>
            <Button
              onClick={() => {
                setEditingFirm(null);
                setPreselectedType(null);
                setDialogOpen(true);
              }}
              className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Firm
            </Button>
            <Button
              onClick={() => {
                setEditingProduct(null);
                setPreselectedProductType(null);
                setPreselectedFirmId(null);
                setProductDialogOpen(true);
              }}
              className="h-11 px-5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
            >
              <Package className="w-4 h-4 mr-2" />
              Add Product
            </Button>
            <Button
              onClick={() => setAddContactOpen(true)}
              className="h-11 px-5 bg-pink-600 hover:bg-pink-700 text-white shadow-sm"
            >
              <User className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Firms list */}
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
        ) : hasResults ? (
          <div>
            {FIRM_TYPES.map((type) =>
              groupedFirms[type] ? (
                <FirmTypeSection
                  key={type}
                  type={type}
                  firms={groupedFirms[type]}
                  onEdit={handleEdit}
                  onDelete={setDeletingFirm}
                  onAddToType={handleAddToType}
                  onAddProduct={handleAddProductFromFirm}
                  onEditProduct={handleEditProduct}
                  forceExpand={!!searchQuery}
                  products={products}
                />
              ) : null
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Building className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchQuery ? "No firms found" : "No firms yet"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {searchQuery
                ? "Try a different search term"
                : 'Click "Add Firm" to create your first firm'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => {
                  setEditingFirm(null);
                  setDialogOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Firm
              </Button>
            )}
          </div>
        )}

        <div className="h-12" />
      </div>

      <AddFirmDialog
        onProductClick={(product) => handleEditProduct(product, false)}
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

      <StatsListModal
        open={!!statsModal}
        onOpenChange={(open) => !open && setStatsModal(null)}
        mode={statsModal}
        firms={firms}
        products={products}
        onFirmClick={handleEdit}
        onProductClick={handleEditProduct}
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

      <AddProductDialog
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
          deleteProductMutation.mutate(product.id);
        }}
        editingProduct={editingProduct}
        firms={firms}
        existingProducts={products}
        preselectedProductType={preselectedProductType}
        preselectedFirmId={preselectedFirmId}
        onFirmClick={(firm) => handleEdit(firm, true)}
      />
    </div>
  );
}