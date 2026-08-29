import React, { useState, useEffect, useRef } from "react";
import { StickyNote, X, Trash2, Plus } from "lucide-react";

const STORAGE_KEY = "mykumpare:quick_notes";

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {}
}

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Persistent quick-notes drawer anchored to the right edge of the screen.
 * Lets the user jot informal updates/reminders without leaving the current view.
 * Notes are stored per-browser in localStorage (personal scratch pad).
 */
export default function QuickNotesDrawer() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = 0;
  }, [open, notes.length]);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    const next = [note, ...notes];
    setNotes(next);
    saveNotes(next);
    setText("");
  };

  const handleDelete = (id) => {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    saveNotes(next);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <>
      {/* Floating toggle — right edge, vertically centered */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close quick notes" : "Quick notes"}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center rounded-l-lg shadow-lg border border-r-0 border-gray-300 bg-white hover:bg-gray-50 text-amber-600 transition-all ${
          open ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0"
        }`}
        style={{ width: 36, height: 64 }}
      >
        <StickyNote className="w-5 h-5" />
        {notes.length > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
            {notes.length > 99 ? "99+" : notes.length}
          </span>
        )}
      </button>

      {/* Drawer panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-[320px] max-w-[85vw] bg-white shadow-2xl border-l border-gray-200 z-[55] flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-amber-50">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-800">Quick Notes</h2>
            <span className="text-xs text-gray-400">({notes.length})</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            title="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Composer */}
        <div className="p-3 border-b border-gray-100">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jot a quick note or reminder… (Ctrl/Cmd+Enter to add)"
            rows={3}
            className="w-full text-sm rounded-lg border border-gray-300 p-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAdd}
              disabled={!text.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add note
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {notes.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">
                No notes yet. Jot down informal updates or reminders — they stay
                saved on this device.
              </p>
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="group rounded-lg border border-gray-200 bg-amber-50/40 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words flex-1">
                    {n.text}
                  </p>
                  <button
                    onClick={() => handleDelete(n.id)}
                    title="Delete note"
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {formatTimestamp(n.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Backdrop — mobile only (desktop keeps the page interactive) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-[54] sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}