import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  MessageSquare, Send, Loader2, ArrowRight, ArrowLeft, Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

export default function ContactChatTab({ contactId, contactName, firmIds = [], firms = [] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const userContactId = user?.linked_contact_id;
  const userIsContact = userContactId === contactId;

  // Fetch all chats involving this contact (as external contact or analyst)
  const { data: externalChats = [], isLoading } = useQuery({
    queryKey: ["contact-external-chats", contactId],
    queryFn: async () => {
      const [asExternal, asAnalyst] = await Promise.all([
        base44.entities.ExternalChat.filter({ external_contact_id: contactId }, "-created_date", 500),
        base44.entities.ExternalChat.filter({ analyst_contact_id: contactId }, "-created_date", 500),
      ]);
      // Merge and deduplicate
      const seen = new Set();
      const merged = [...asExternal, ...asAnalyst].filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      return merged;
    },
    enabled: !!contactId,
  });

  const sendChatMutation = useMutation({
    mutationFn: async ({ msg }) => {
      const todayStr = new Date().toISOString().split("T")[0];
      const firmId = firmIds?.[0];
      const firmName = firms?.find?.((f) => f.id === firmId)?.name || firmIds?.[0] || "";
      const chat = await base44.entities.ExternalChat.create({
        external_firm_id: firmId,
        external_firm_name: firmName,
        direction: "outbound",
        sender_contact_id: userContactId,
        sender_name: user?.full_name || user?.email || "",
        sender_email: user?.email || "",
        external_contact_id: contactId,
        external_contact_name: contactName,
        analyst_contact_id: userContactId,
        analyst_name: user?.full_name || "",
        message: msg,
        response: "",
        received_date: todayStr,
        responded_date: "",
        status: "pending",
      });
      return chat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-external-chats", contactId] });
      setMessage("");
      toast({ title: "Message sent", description: "Your message has been sent to the external firm." });
    },
    onError: (err) => {
      toast({ title: "Failed to send", description: err?.message, variant: "destructive" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ chatId, response }) => {
      const todayStr = new Date().toISOString().split("T")[0];
      return base44.entities.ExternalChat.update(chatId, {
        response,
        responded_date: todayStr,
        status: "completed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-external-chats", contactId] });
      setRespondingTo(null);
      setResponseText("");
    },
  });

  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState("");

  const statusCounts = useMemo(() => ({
    all: externalChats.length,
    pending: externalChats.filter((c) => c.status === "pending").length,
    completed: externalChats.filter((c) => c.status === "completed").length,
  }), [externalChats]);

  const filteredChats = useMemo(() => {
    let result = externalChats;
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (!searchTerm.trim()) return result;
    const q = searchTerm.toLowerCase();
    return result.filter((c) =>
      (c.sender_name || "").toLowerCase().includes(q) ||
      (c.external_contact_name || "").toLowerCase().includes(q) ||
      (c.analyst_name || "").toLowerCase().includes(q) ||
      (c.message || "").toLowerCase().includes(q) ||
      (c.response || "").toLowerCase().includes(q)
    );
  }, [externalChats, searchTerm, statusFilter]);

  const sortedChats = useMemo(() => {
    return [...filteredChats].sort((a, b) =>
      (b.created_date || "").localeCompare(a.created_date || "")
    );
  }, [filteredChats]);

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center">
        Save the contact to view chats.
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1">
      {/* Send new message */}
      {!userIsContact && firmIds.length > 0 && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
          <Label className="text-xs font-medium text-indigo-700 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Send a message to {contactName}
          </Label>
          <Textarea
            className="min-h-20 text-sm bg-white"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sendChatMutation.isPending}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={sendChatMutation.isPending || !message.trim()}
              onClick={() => sendChatMutation.mutate({ msg: message.trim() })}
            >
              {sendChatMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Message
            </Button>
          </div>
        </div>
      )}

      {/* Status filter tabs + search */}
      {externalChats.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-1 border-b border-gray-200">
            {[
              { key: "all", label: "All", count: statusCounts.all },
              { key: "pending", label: "Pending", count: statusCounts.pending },
              { key: "completed", label: "Completed", count: statusCounts.completed },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  statusFilter === tab.key
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                  statusFilter === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              className="w-full h-8 pl-7 pr-3 text-xs border border-gray-200 rounded-md"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Chat list */}
      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : sortedChats.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          <MessageSquare className="w-5 h-5 text-gray-300 mx-auto mb-1" />
          No chats yet. {firmIds.length > 0 && !userIsContact && "Send a message above to start a conversation."}
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sortedChats.map((chat) => {
            const isOutbound = chat.direction === "outbound";
            const isCompleted = chat.status === "completed";
            return (
              <div
                key={chat.id}
                className={`rounded-lg border p-3 ${
                  isCompleted
                    ? "bg-gray-50 border-gray-200"
                    : isOutbound
                      ? "bg-indigo-50/40 border-indigo-200"
                      : "bg-violet-50/40 border-violet-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className={`text-[9px] ${isOutbound ? "bg-indigo-100 text-indigo-700" : "bg-violet-100 text-violet-700"}`}>
                    {isOutbound ? (
                      <><ArrowRight className="w-2.5 h-2.5" /> Outbound</>
                    ) : (
                      <><ArrowLeft className="w-2.5 h-2.5" /> Inbound</>
                    )}
                  </Badge>
                  <span className="text-xs font-medium text-gray-700">{chat.sender_name || "Unknown"}</span>
                  <span className="text-[10px] text-gray-400">→</span>
                  <span className="text-xs text-gray-500">
                    {isOutbound ? chat.external_contact_name : chat.analyst_name}
                  </span>
                  <Badge
                    className={`text-[9px] ml-auto ${
                      isCompleted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {isCompleted ? "Responded" : "Pending"}
                  </Badge>
                </div>
                <div className="ml-1 space-y-1.5">
                  <div className={`rounded-lg px-3 py-2 ${isOutbound ? "bg-indigo-100/60" : "bg-violet-100/60"}`}>
                    <p className="text-xs text-gray-700">{chat.message}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">Sent: {fmtDate(chat.received_date)}</p>
                  </div>
                  {chat.response && (
                    <div className="rounded-lg px-3 py-2 bg-emerald-50 border-l-2 border-emerald-400">
                      <p className="text-xs text-gray-700">{chat.response}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">Responded: {fmtDate(chat.responded_date)}</p>
                    </div>
                  )}
                  {/* Inline response for inbound pending chats when viewing as the analyst */}
                  {!isOutbound && !isCompleted && userContactId === chat.analyst_contact_id && (
                    <div className="mt-1">
                      {respondingTo?.id === chat.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            className="w-full text-xs border border-gray-200 rounded-md p-2 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="Type your response..."
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            disabled={respondMutation.isPending}
                          />
                          <div className="flex gap-1.5">
                            <Button type="button" size="sm" className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white" disabled={respondMutation.isPending || !responseText.trim()} onClick={() => respondMutation.mutate({ chatId: chat.id, response: responseText.trim() })}>
                              {respondMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send Response
                            </Button>
                            <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setRespondingTo(null); setResponseText(""); }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" size="sm" className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setRespondingTo(chat)}>
                          <MessageSquare className="w-3 h-3" /> Respond
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}