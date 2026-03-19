import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import DeletedRecordsModal from "../components/deleted/DeletedRecordsModal";

export default function DeletedRecords() {
  const queryClient = useQueryClient();

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

  const deletedRecords = {
    firms: deletedFirms,
    products: deletedProducts,
    contacts: deletedContacts,
    portfolios: deletedPortfolios,
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold mb-6">Deleted Records</h1>
        <DeletedRecordsModal
          open={true}
          onOpenChange={() => {}}
          deletedRecords={deletedRecords}
        />
      </div>
    </div>
  );
}