import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import QuestionnaireDialog from "./QuestionnaireDialog";
import { useAuth } from "@/lib/AuthContext";
import { format, parseISO } from "date-fns";
import { Plus, Search, ClipboardList, Pencil, Building2, User, Clock } from "lucide-react";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Submitted: "bg-purple-50 text-purple-700 border-purple-200",
  "Under Review": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/**
 * Picker modal for browsing and managing questionnaires.
 * Lists all questionnaires with progress bars and status badges.
 * Click a questionnaire to open the QuestionnaireDialog for answering/reviewing.
 * "Add" button opens the QuestionnaireDialog in create mode.
 *
 * Props:
 *   open, onClose
 *   user, firms, contacts, products — passed through to QuestionnaireDialog
 *   onFirmClick, onContactClick, onProductClick — navigation callbacks
 */
export default function QuestionnairePickerModal({
  open,
  onClose,
  user,
  firms = [],
  contacts = [],
  products = [],
  onFirmClick,
  onContactClick,
  onProductClick,
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // questionnaire being edited/answered
  const [showCreate, setShowCreate] = useState(false);

  const { data: questionnaires = [], isLoading } = useQuery({
    queryKey: ["questionnaires"],
    queryFn: () => base44.entities.Questionnaire.list("-created_date", 5000),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return questionnaires;
    return questionnaires.filter((item) =>
      (item.name || "").toLowerCase().includes(q) ||
      (item.firm_name || "").toLowerCase().includes(q) ||
      (item.assignee_contact_name || "").toLowerCase().includes(q) ||
      (item.template_name || "").toLowerCase().includes(q) ||
      (item.status || "").toLowerCase().includes(q)
    );
  }, [questionnaires, search]);

  const calcProgress = (item) => {
    if (!item.sections) return { total: 0, completed: 0, pct: 0 };
    let total = 0, completed = 0;
    item.sections.forEach((s) => {
      (s.sub_sections || []).forEach((ss) => {
        total++;
        if (ss.status === "completed") completed++;
      });
    });
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  return (
    <>
      <Dialog open={open && !selected && !showCreate} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
                <span>Questionnaires ({questionnaires.length})</span>
              </div>
              <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5" /> Add Questionnaire
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              placeholder="Search by name, firm, assignee, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* List */}
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading questionnaires...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {search ? "No questionnaires match your search." : "No questionnaires yet. Click 'Add Questionnaire' to create one."}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const prog = calcProgress(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name || "Untitled"}</p>
                        <p className="text-[10px] text-gray-400 truncate">{item.template_name}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${STATUS_STYLES[item.status] || ""}`}>
                        {item.status}
                      </Badge>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
                      {item.firm_name && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="w-2.5 h-2.5" /> {item.firm_name}
                        </span>
                      )}
                      {item.assignee_contact_name && (
                        <span className="flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" /> {item.assignee_contact_name}
                        </span>
                      )}
                      {item.due_date && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> Due: {fmtDate(item.due_date)}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    {prog.total > 0 && (
                      <div className="space-y-0.5">
                        <Progress value={prog.pct} className="h-1.5" />
                        <div className="text-right text-[9px] text-gray-400">
                          {prog.completed}/{prog.total} sub-sections completed ({prog.pct}%)
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit / Answer / Review dialog */}
      {selected && (
        <QuestionnaireDialog
          open={!!selected}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          editQuestionnaire={selected}
          user={user}
          firms={firms}
          contacts={contacts}
          products={products}
          onFirmClick={onFirmClick}
          onContactClick={onContactClick}
          onProductClick={onProductClick}
        />
      )}

      {/* Create dialog */}
      {showCreate && (
        <QuestionnaireDialog
          open={showCreate}
          onOpenChange={(o) => { if (!o) setShowCreate(false); }}
          editQuestionnaire={null}
          user={user}
          firms={firms}
          contacts={contacts}
          products={products}
          onFirmClick={onFirmClick}
          onContactClick={onContactClick}
          onProductClick={onProductClick}
        />
      )}
    </>
  );
}