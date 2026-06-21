import { useState, useRef, useEffect } from "react";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
}: DeleteConfirmModalProps) {
  const [typed, setTyped]       = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (typed.toLowerCase() !== "delete") {
      setError('Please type "delete" to confirm.');
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    setError("");
    setIsDeleting(true);
    try {
      await onConfirm();
      setTyped("");
    } catch (err) {
      console.error("Deletion failed:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setTyped("");
      setError("");
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl shadow-black/20 p-0 overflow-hidden rounded-2xl">
        {/* Danger banner */}
        <div className="bg-gradient-to-r from-red-700 to-red-800 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <DialogHeader>
              <DialogTitle className="text-white font-bold text-base leading-tight">{title}</DialogTitle>
            </DialogHeader>
            <p className="text-red-200 text-xs mt-0.5">This action is permanent and cannot be undone.</p>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Description */}
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-sm text-red-800 leading-relaxed">
              {description || "You are about to permanently delete this record and all associated data."}
            </p>
            <p className="text-xs text-red-600 font-semibold mt-2">
              ⚠ Contact an Executive for approval before proceeding.
            </p>
          </div>

          {/* Confirm input */}
          <form onSubmit={handleConfirm} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Type <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-red-700 text-xs">delete</span> to confirm
              </label>
              <motion.div animate={shake ? { x: [-5, 5, -4, 4, -2, 2, 0] } : {}}>
                <input
                  ref={inputRef}
                  type="text"
                  required
                  value={typed}
                  onChange={(e) => { setTyped(e.target.value); setError(""); }}
                  placeholder="delete"
                  autoComplete="off"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 transition-all ${
                    error
                      ? "border-red-400 focus:ring-red-300"
                      : typed.toLowerCase() === "delete"
                        ? "border-emerald-400 focus:ring-emerald-300"
                        : "border-neutral-200 focus:ring-red-800/20 focus:border-red-600"
                  }`}
                />
              </motion.div>
              {error && (
                <p className="text-red-600 text-xs mt-1.5 font-medium">{error}</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-xl transition-all duration-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDeleting || typed.toLowerCase() !== "delete"}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-neutral-300 disabled:to-neutral-400 text-white text-sm font-bold rounded-xl transition-all duration-150 disabled:cursor-not-allowed shadow-sm"
              >
                {isDeleting
                  ? <><Loader2 size={14} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={14} /> Delete</>
                }
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
