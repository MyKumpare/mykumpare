import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone, Mail, Users, FileText, MoreHorizontal, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Note", "Other"];

const ACTIVITY_ICONS = {
  Call: { icon: Phone, color: "text-blue-500", bg: "bg-blue-50" },
  Email: { icon: Mail, color: "text-green-500", bg: "bg-green-50" },
  Meeting: { icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
  Note: { icon: FileText, color: "text-amber-500", bg: "bg-amber-50" },
  Other: { icon: MoreHorizontal, color: "text-gray-500", bg: "bg-gray-100" },
};

function ActivityForm({ contactId, onSaved, onCancel }) {
  const queryClient = useQueryClient();
  const [activityType, setActivityType] = useState("Call");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactActivity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities", contactId] });
      onSaved();
    },
  });

  const handleSave = () => {
    if (!activityType || !activityDate) return;
    createMutation.mutate({ contact_id: contactId, activity_type: activityType, activity_date: activityDate, subject: subject.trim(), notes: notes.trim() });
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">Log Activity</span>
        <button type="button" onClick={onCancel}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Type</Label>
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Date</Label>
          <Input
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Subject</Label>
        <Input
          placeholder="Brief subject..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Notes</Label>
        <Textarea
          placeholder="Activity details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-16 text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!activityType || !activityDate || createMutation.isPending}
          onClick={handleSave}
        >
          {createMutation.isPending ? "Saving..." : "Save Activity"}
        </Button>
      </div>
    </div>
  );
}

function ActivityItem({ activity, contactId }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContactActivity.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact_activities", contactId] }),
  });

  const { icon: Icon, color, bg } = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.Other;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">{activity.activity_type}</span>
            {activity.subject && (
              <span className="text-xs text-gray-500 truncate">· {activity.subject}</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {activity.activity_date ? format(new Date(activity.activity_date + "T00:00:00"), "MMM d, yyyy") : "—"}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-2">
          {activity.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.notes}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">No notes recorded.</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => deleteMutation.mutate(activity.id)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactActivitiesTab({ contactId }) {
  const [showForm, setShowForm] = useState(false);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["contact_activities", contactId],
    queryFn: () => base44.entities.ContactActivity.filter({ contact_id: contactId }, "-activity_date"),
    enabled: !!contactId,
  });

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the contact first to log activities
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Log Activity
        </Button>
      </div>

      {showForm && (
        <ActivityForm
          contactId={contactId}
          onSaved={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No activities logged yet
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} contactId={contactId} />
          ))}
        </div>
      )}
    </div>
  );
}