import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  MessageSquare, Phone, Mail, Send, Loader2, User, Search, Filter,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

export default function ExternalAnalystChat({ firmId, firmName, contactId, contactName, readOnly }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [selectedAnalystId, setSelectedAnalystId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [analystFilter, setAnalystFilter] = useState("all");

  // Fetch assigned analysts for this external firm
  const { data: analystData, isLoading: analystsLoading } = useQuery({
    queryKey: ["external-firm-analysts", firmId],
    queryFn: async () => {
      const resp = await base44.functions.invoke("getExternalFirmAnalyst", { firm_id: firmId });
      return resp.data || resp;
    },
    enabled: !!firmId,
  });

  const analysts = analystData?.analysts || [];

  // Fetch all chats for this external firm
  const { data: allChats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["external-chats", firmId],
    queryFn: () => base44.entities.ExternalChat.filter({ external_firm_id: firmId }, "-created_date", 500),
    enabled: !!firmId,
  });

  const sendChatMutation = useMutation({
    mutationFn: async ({ analyst, msg }) => {
      const todayStr = new Date().toISOString().split("T")[0];
      const chat = await base44.entities.ExternalChat.create({
        due_diligence_id: analyst.due_diligence_id,
        external_firm_id: firmId,
        external_firm_name: firmName,
        sender_contact_id: contactId,
        sender_name: contactName,
        sender_email: "",
        analyst_contact_id: analyst.contact_id,
        analyst_name: analyst.name,
        product_name: analyst.product_name || "",
        message: msg,
        response: "",
        received_date: todayStr,
        responded_date: "",
        status: "pending",
      });
      // Create notification for the analyst
      await base44.entities.DdNotification.create({
        contact_id: analyst.contact_id,
        contact_name: analyst.name,
        type: "external_chat",
        title: `New chat from ${contactName}`,
        message: msg,
        due_diligence_id: analyst.due_diligence_id,
        firm_name: firmName,
        product_name: analyst.product_name || "",
        external_chat_id: chat.id,
        status: "unread",
      });
      return chat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-chats", firmId] });
      setMessage("");
      toast({ title: "Message sent", description: "The analyst will be notified of your message." });
    },
    onError: (err) => {
      toast({ title: "Failed to send", description: err?.message, variant: "destructive" });
    },
  });

  // Unique analyst names for filter dropdown
  const analystNames = useMemo(() => {
    const names = new Set(analysts.map((a) => a.name).filter(Boolean));
    allChats.forEach((c) => { if (c.analyst_name) names.add(c.analyst_name); });
    return [...names].sort();
  }, [analysts, allChats]);

  // Filter and sort chats
  const filteredChats = useMemo(() => {
    let result = [...allChats];
    if (analystFilter !== "all") {
      result = result.filter((c) => c.analyst_name === analystFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((c) =>
        (c.sender_name || "").toLowerCase().includes(q) ||
        (c.analyst_name || "").toLowerCase().includes(q) ||
        (c.message || "").toLowerCase().includes(q) ||
        (c.response || "").toLowerCase().includes(q)
      );
    }
    // Sort by sender_name, then by created_date desc within same sender
    result.sort((a, b) => {
      const nameCmp = (a.sender_name || "").localeCompare(b.sender_name || "");
      if (nameCmp !== 0) return nameCmp;
      return (b.created_date || "").localeCompare(a.created_date || "");
    });
    return result;
  }, [allChats, analystFilter, searchTerm]);

  if (analystsLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
      </div>
    );
  }

  if (analysts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto" />
        <p className="text-sm font-medium text-gray-700 mt-2">No analyst assigned yet</p>
        <p className="text-xs text-gray-400 mt-1">Once a primary analyst is assigned to your firm's due diligence, their contact information will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analyst Contact Info Cards */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <User className="w-4 h-4 text-indigo-500" /> Your Analyst ({analysts.length})
        </h2>
        {analysts.map((analyst) => (
          <div key={analyst.contact_id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                {(analyst.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{analyst.name || "Analyst"}</p>
                {analyst.product_name && (
                  <p className="text-[11px] text-gray-500 truncate">Product: {analyst.product_name}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {analyst.phone && (
                    <a href={`tel:${analyst.phone.replace(/[^+\d]/g, "")}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {analyst.phone}
                    </a>
                  )}
                  {analyst.email && (
                    <a href={`mailto:${analyst.email}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {analyst.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
            {/* Chat input */}
            {!readOnly && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs text-gray-500">Send a message</Label>
                <Textarea
                  className="min-h-20 text-sm"
                  placeholder={`Type a message to ${analyst.name || "the analyst"}...`}
                  value={message && selectedAnalystId === analyst.contact_id ? message : ""}
                  onChange={(e) => { setSelectedAnalystId(analyst.contact_id); setMessage(e.target.value); }}
                  disabled={sendChatMutation.isPending}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={sendChatMutation.isPending || !message.trim() || selectedAnalystId !== analyst.contact_id}
                    onClick={() => sendChatMutation.mutate({ analyst, msg: message.trim() })}
                  >
                    {sendChatMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send Message
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chat History */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> All Chats ({filteredChats.length})
          </h3>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              className="h-8 pl-7 text-xs"
              placeholder="Search by name or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
              value={analystFilter}
              onChange={(e) => setAnalystFilter(e.target.value)}
            >
              <option value="all">All Analysts</option>
              {analystNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chat list */}
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {chatsLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-5 h-5 text-gray-300 animate-spin mx-auto" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No chats yet. Send a message above to start.</div>
          ) : (
            filteredChats.map((chat) => (
              <div key={chat.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                    {(chat.sender_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{chat.sender_name || "Unknown"}</span>
                  <span className="text-[10px] text-gray-400">→</span>
                  <span className="text-xs text-gray-500">{chat.analyst_name || "Analyst"}</span>
                  <Badge
                    className={`text-[9px] ml-auto ${
                      chat.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {chat.status === "completed" ? "Responded" : "Pending"}
                  </Badge>
                </div>
                <div className="ml-8 space-y-1.5">
                  <div className="bg-indigo-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-700">{chat.message}</p>
                    <p className="text-[9px] text-gray-400 mt-1">Sent: {fmtDate(chat.received_date)}</p>
                  </div>
                  {chat.response && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 border-l-2 border-emerald-400">
                      <p className="text-xs text-gray-700">{chat.response}</p>
                      <p className="text-[9px] text-gray-400 mt-1">Responded: {fmtDate(chat.responded_date)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}