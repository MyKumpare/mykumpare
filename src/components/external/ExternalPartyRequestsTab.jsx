import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { UserCheck, UserX, Mail, Building2, AlertCircle, Loader2, ChevronRight } from "lucide-react";

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
};

export default function ExternalPartyRequestsTab() {
  const queryClient = useQueryClient();
  const [actioning, setActioning] = useState(null);
  const [rejectMode, setRejectMode] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["external_party_requests"],
    queryFn: () => base44.entities.ExternalPartyRequest.list("-created_date", 500),
  });

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  const handleAction = async (request, action, extra = {}) => {
    setActioning(request.id);
    try {
      const res = await base44.functions.invoke("approveExternalParty", {
        request_id: request.id,
        action,
        rejection_reason: extra.rejection_reason,
        use_existing_firm_id: extra.use_existing_firm_id,
      });

      queryClient.invalidateQueries({ queryKey: ["external_party_requests"] });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["pending_invitations"] });

      toast({
        title: action === "approve" ? "Request approved" : "Request rejected",
        description: action === "approve"
          ? `${request.first_name} ${request.last_name} from ${request.firm_name} has been invited.`
          : `The request from ${request.firm_name} has been rejected.`,
      });

      setSelectedRequest(null);
      setRejectMode(null);
      setRejectionReason("");
    } catch (err) {
      toast({ title: "Action failed", description: err?.message, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  };

  const renderRequest = (req) => (
    <div key={req.id} className="rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {[req.salutation, req.first_name, req.middle_name, req.last_name, req.suffix].filter(Boolean).join(" ")}
            </p>
            {req.is_first_user && (
              <Badge className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">First User (Admin)</Badge>
            )}
          </div>
          <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
            <Mail className="w-3 h-3" /> {req.email}
          </p>
          <p className="text-[11px] text-gray-500 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {req.firm_name}
            <span className="text-gray-300">·</span>
            {(req.firm_types || []).join(", ")}
          </p>
          {req.phone && (
            <p className="text-[10px] text-gray-400">
              +{req.phone.country_code} ({req.phone.area_code}) {req.phone.number_mid}-{req.phone.number_last}
            </p>
          )}
        </div>

        {req.status === "pending" ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm" className="h-7 text-xs"
              disabled={actioning === req.id}
              onClick={() => handleAction(req, "approve")}
            >
              {actioning === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
              Approve
            </Button>
            <Button
              size="sm" variant="outline" className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              disabled={actioning === req.id}
              onClick={() => { setRejectMode(req.id); setRejectionReason(""); }}
            >
              <UserX className="w-3 h-3" /> Reject
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${
            req.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
          }`}>
            {req.status}
          </Badge>
        )}
      </div>

      {/* Rejection form */}
      {rejectMode === req.id && (
        <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
          <Input
            className="h-8 text-xs bg-white"
            placeholder="Reason for rejection (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRejectMode(null)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs bg-rose-600 hover:bg-rose-700"
              disabled={actioning === req.id}
              onClick={() => handleAction(req, "reject", { rejection_reason: rejectionReason })}>
              Confirm Reject
            </Button>
          </div>
        </div>
      )}

      {req.status !== "pending" && req.approved_date && (
        <p className="text-[10px] text-gray-400 mt-1">
          {req.status} by {req.approved_by_name || "admin"} on {fmtDate(req.approved_date)}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Pending requests */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Pending Requests ({pending.length})
        </h2>
        {isLoading ? (
          <div className="text-center py-6 text-sm text-gray-400">Loading requests...</div>
        ) : pending.length === 0 ? (
          <div className="text-center py-6 rounded-lg border border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-1.5">{pending.map(renderRequest)}</div>
        )}
      </div>

      {/* Processed requests */}
      {processed.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-2">Processed ({processed.length})</h2>
          <div className="space-y-1.5">{processed.slice(0, 10).map(renderRequest)}</div>
        </div>
      )}
    </div>
  );
}