import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import DuplicateContactsReview from "@/components/contacts/DuplicateContactsReview";

export default function DuplicateContacts() {
  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Duplicate Contacts</h1>
            <p className="text-sm text-gray-500">
              Review contacts flagged as potential duplicates by name, email, phone, or photo similarity. Merge sets into a single record — all data (firms, phones, addresses, education, experience, activities, tasks, org chart, ownership, and product team links) is combined into the kept record.
            </p>
          </div>
        </div>
        <DuplicateContactsReview />
      </div>
    </div>
  );
}