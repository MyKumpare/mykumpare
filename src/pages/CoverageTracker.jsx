import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCoverageData } from "@/hooks/useCoverageData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCheck, Building2, AlertTriangle, Users, ChevronRight, ChevronDown, User,
} from "lucide-react";
import CoverageAlertsPanel from "@/components/coverage/CoverageAlertsPanel";

const LIFECYCLE_STYLES = {
  Pipeline: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Due Diligence": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Funded: "bg-purple-50 text-purple-700 border-purple-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

function StatCard({ icon: Icon, label, value, sublabel, color }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 truncate">{label}</p>
            {sublabel && <p className="text-[10px] text-gray-400 truncate">{sublabel}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CoverageTracker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLoading, ddRecords, firms, contacts, firmCoverage, uncoveredFirms, analysts } = useCoverageData();
  const [showTeam, setShowTeam] = useState(false);

  // Resolve the signed-in user's contact (linked record or email match).
  const myContactId = useMemo(() => {
    if (!user) return null;
    if (user.linked_contact_id) return user.linked_contact_id;
    if (user.email) {
      const match = contacts.find((c) => (c.email || "").toLowerCase() === user.email.toLowerCase());
      return match?.id || null;
    }
    return null;
  }, [user, contacts]);

  // The Xponance owner firm — analysts are contacts belonging to this firm.
  const ownerFirmId = useMemo(() => {
    const xponance = firms.find((f) => (f.name || "").toLowerCase() === "xponance, inc.");
    return xponance?.id || user?.linked_firm_id || null;
  }, [firms, user]);

  // My active assignments (primary + secondary).
  const myAssignments = useMemo(() => {
    if (!myContactId) return [];
    return ddRecords
      .filter((dd) => dd.primaryAnalyst?.id === myContactId || dd.secondaryAnalyst?.id === myContactId)
      .sort((a, b) => (a.firm_name || "").localeCompare(b.firm_name || ""));
  }, [ddRecords, myContactId]);

  const myPrimaryFirmCount = useMemo(
    () => new Set(myAssignments.filter((dd) => dd.primaryAnalyst?.id === myContactId).map((dd) => dd.firm_id)).size,
    [myAssignments, myContactId]
  );
  const mySecondaryFirmCount = useMemo(
    () => new Set(myAssignments.filter((dd) => dd.secondaryAnalyst?.id === myContactId).map((dd) => dd.firm_id)).size,
    [myAssignments, myContactId]
  );

  // Other team members (analysts in the Xponance firm, excluding me).
  const teamMembers = useMemo(() => {
    if (!ownerFirmId) return [];
    const ownerContactIds = new Set(
      contacts.filter((c) => (c.firm_ids || []).includes(ownerFirmId)).map((c) => c.id)
    );
    return analysts
      .filter((a) => a.id !== myContactId && ownerContactIds.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [analysts, contacts, ownerFirmId, myContactId]);

  const myContact = contacts.find((c) => c.id === myContactId);
  const myName = user?.full_name || (myContact ? [myContact.first_name, myContact.last_name].filter(Boolean).join(" ") : "") || "Me";

  const onFirmClick = (firmId) => {
    // Navigate to Home and open the firm — simplest is to go home and let user search.
    // HashRouter: jump to home with a query the search picks up is complex; just go home.
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <UserCheck className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-gray-800">My Coverage Tracker</h2>
        <Badge variant="outline" className="text-xs border-indigo-200 bg-indigo-50 text-indigo-700">
          {myName}
        </Badge>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Firms I Cover (Primary)" value={myPrimaryFirmCount} color="bg-indigo-600" />
        <StatCard icon={UserCheck} label="Firms I Cover (Secondary)" value={mySecondaryFirmCount} color="bg-violet-600" />
        <StatCard icon={Users} label="My Active Assignments" value={myAssignments.length} color="bg-emerald-600" />
        <StatCard icon={AlertTriangle} label="Firms With No Coverage" value={uncoveredFirms.length} color="bg-amber-500" />
      </div>

      {/* Coverage assignment alerts */}
      <CoverageAlertsPanel contactId={myContactId} />

      {/* My covered firms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Firms I Cover
            <span className="text-xs text-gray-400 font-normal">({myAssignments.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myAssignments.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">
              You have no active coverage assignments. Firms you cover as primary or secondary analyst will appear here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {myAssignments.map((dd) => {
                const role = dd.primaryAnalyst?.id === myContactId ? "primary" : "secondary";
                return (
                  <div
                    key={dd.id}
                    className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2"
                  >
                    <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{dd.firm_name || "—"}</p>
                      <p className="text-[11px] text-gray-400 truncate">{dd.product_name || "—"}</p>
                    </div>
                    <Badge className={`text-[10px] flex-shrink-0 ${role === "primary" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-violet-100 text-violet-700 border-violet-200"}`}>
                      {role === "primary" ? "Primary" : "Secondary"}
                    </Badge>
                    {dd.currentStage && (
                      <span className="text-[10px] text-gray-500 hidden sm:inline truncate max-w-[140px]">{dd.currentStage}</span>
                    )}
                    <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${LIFECYCLE_STYLES[dd.lifecycle] || ""}`}>
                      {dd.lifecycle}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team members toggle */}
      {teamMembers.length > 0 && (
        <Card>
          <button
            type="button"
            onClick={() => setShowTeam((v) => !v)}
            className="w-full text-left"
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {showTeam ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <Users className="w-4 h-4 text-emerald-500" /> Other Team Members
                <span className="text-xs text-gray-400 font-normal">({teamMembers.length})</span>
              </CardTitle>
            </CardHeader>
          </button>
          {showTeam && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {teamMembers.map((a) => {
                  const photo = a.contact?.photo_url;
                  const title = a.contact?.title;
                  return (
                    <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-center gap-2.5">
                        {photo ? (
                          <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-indigo-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                          {title && <p className="text-xs text-gray-400 truncate">{title}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">{a.primaryFirms.size} primary</Badge>
                          <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">{a.secondaryFirms.size} secondary</Badge>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {a.assignments.slice(0, 6).map(({ dd, role }, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 truncate flex-1 min-w-0">{dd.firm_name}</span>
                            <span className={`text-[9px] font-medium px-1 rounded flex-shrink-0 ${role === "primary" ? "bg-indigo-50 text-indigo-600" : "bg-violet-50 text-violet-600"}`}>
                              {role === "primary" ? "P" : "S"}
                            </span>
                            <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${LIFECYCLE_STYLES[dd.lifecycle] || ""}`}>{dd.lifecycle}</Badge>
                          </div>
                        ))}
                        {a.assignments.length > 6 && (
                          <p className="text-[10px] text-gray-400 pl-5">+{a.assignments.length - 6} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Firms with no coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Firms With No Assigned Coverage
            <span className="text-xs text-gray-400 font-normal">({uncoveredFirms.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uncoveredFirms.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">
              Every firm has an assigned analyst. 🎉
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {uncoveredFirms.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1 min-w-0">{f.name}</span>
                  <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 bg-amber-50 flex-shrink-0">No coverage</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}