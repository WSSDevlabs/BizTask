import { useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon, Upload, Trash2, Download, FileText, Film, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass, SearchInput,
} from "@/components/ui/shared";
import { uploadFile } from "@/lib/backend-utils";
import {
  subscribeAssets, addAsset, deleteAsset, subscribeCampaigns, subscribeProjects,
} from "@/lib/db";
import { formatDate, toJsDate } from "@/lib/utils";
import type { Asset, AssetType, Campaign, Project } from "@/types";

function detectType(file: File): AssetType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

const typeIcon: Record<AssetType, typeof ImageIcon> = { image: ImageIcon, video: Film, document: FileText };

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Asset | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeAssets((rows) => { setAssets(rows); setLoading(false); }),
      subscribeCampaigns(setCampaigns),
      subscribeProjects(setProjects),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filtered = useMemo(
    () => assets.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    ),
    [assets, search]
  );

  async function handleUpload() {
    if (!file) { setError("Select a file"); return; }
    setUploading(true); setError("");
    try {
      const url = await uploadFile(file, "assets");
      await addAsset({
        name: name || file.name, type: detectType(file), url, size: file.size,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        campaignId: campaignId || undefined, projectId: projectId || undefined,
      } as Omit<Asset, "id" | "createdAt">);
      setUploadOpen(false);
      setFile(null); setName(""); setTags(""); setCampaignId(""); setProjectId("");
    } catch (err) {
      setError("Upload failed. " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={ImageIcon}
        title="Assets"
        subtitle="Multimedia library"
        actions={<PrimaryButton onClick={() => { setError(""); setUploadOpen(true); }}><Upload size={16} /> Upload</PrimaryButton>}
      />

      <div className="mb-5"><SearchInput value={search} onChange={setSearch} placeholder="Search by name or tag..." /></div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={ImageIcon} label="No assets yet" /></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((a) => {
            const Icon = typeIcon[a.type];
            return (
              <Card key={a.id} className="overflow-hidden group">
                <div className="aspect-video bg-neutral-100 flex items-center justify-center overflow-hidden">
                  {a.type === "image" ? (
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon size={36} className="text-neutral-400" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-black truncate">{a.name}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{a.createdAt ? formatDate(toJsDate(a.createdAt)!) : ""}</p>
                  {a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {a.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{t}</span>)}
                    </div>
                  )}
                  <div className="flex gap-1 mt-3 pt-2 border-t border-neutral-100">
                    <a href={a.url} target="_blank" rel="noreferrer" download className="flex-1 flex items-center justify-center gap-1 text-xs text-neutral-600 hover:bg-neutral-100 py-1.5 rounded"><Download size={13} /> Download</a>
                    <button onClick={() => setToDelete(a)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 size={13} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Upload Asset</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="File">
              <input type="file" className={inputClass} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !name) setName(f.name); }} />
            </Field>
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Tags (comma separated)"><input className={inputClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="logo, banner, q3" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Campaign">
                <select className={inputClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">None</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Project">
                <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setUploadOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleUpload} disabled={uploading}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload
              </PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteAsset(toDelete.id); setToDelete(null); }}
        title="Delete Asset"
        description={`Delete "${toDelete?.name}"?`}
      />
    </div>
  );
}
