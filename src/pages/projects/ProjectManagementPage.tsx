import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass, SearchInput,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import { subscribeExternalTools, addExternalTool, deleteExternalTool } from "@/lib/db";
import type { ExternalTool } from "@/types";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ProjectManagementPage() {
  const [tools, setTools] = useState<ExternalTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ExternalTool | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeExternalTools((rows) => { setTools(rows); setLoading(false); }), []);

  const filtered = useMemo(
    () => tools.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      hostname(t.url).toLowerCase().includes(search.toLowerCase())
    ),
    [tools, search]
  );

  async function handleAdd() {
    if (!name.trim()) { setError("Enter a name"); return; }
    if (!url.trim()) { setError("Enter a link"); return; }
    const finalUrl = normalizeUrl(url);
    try {
      new URL(finalUrl);
    } catch {
      setError("That doesn't look like a valid link");
      return;
    }
    setSaving(true); setError("");
    try {
      await addExternalTool({ name: name.trim(), url: finalUrl });
      setAddOpen(false);
      setName(""); setUrl("");
    } catch (err) {
      setError("Failed to add. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  usePageHeader({ actions: <PrimaryButton onClick={() => { setError(""); setAddOpen(true); }}><Plus size={16} /> Add Link</PrimaryButton> });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
        <div className="mb-5"><SearchInput value={search} onChange={setSearch} placeholder="Search links..." /></div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Link2} label="No links yet" description="Add a link to an external tool to get a quick-access card here." /></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="group relative overflow-hidden">
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex flex-col items-center text-center gap-2.5 px-4 py-6 hover:bg-neutral-50 transition"
              >
                <img
                  src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname(t.url))}`}
                  alt=""
                  className="w-10 h-10 rounded-lg"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                <p className="text-sm font-semibold text-black truncate max-w-full">{t.name}</p>
                <p className="text-xs text-neutral-400 truncate max-w-full">{hostname(t.url)}</p>
              </a>
              <button
                onClick={() => setToDelete(t)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-600 transition shadow-sm"
                aria-label={`Delete ${t.name}`}
              >
                <Trash2 size={13} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Add Link</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Google Drive" /></Field>
            <Field label="Link"><input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="drive.google.com/..." /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
              </PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteExternalTool(toDelete.id); setToDelete(null); }}
        title="Delete Link"
        description={`Delete "${toDelete?.name}"?`}
      />
    </div>
  );
}
