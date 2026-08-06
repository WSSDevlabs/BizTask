import { useEffect, useMemo, useState } from "react";
import {
  Building2, Plus, Trash2, Image as ImageIcon, Upload, Download, FileText, Film, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass, SearchInput,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import { fileToDataUrl } from "@/lib/backend-utils";
import {
  subscribeDepartments, addDepartment, deleteDepartment,
  subscribeAssets, addAsset, deleteAsset, subscribeCampaigns, subscribeProjects,
} from "@/lib/db";
import { cn, formatDate, toJsDate } from "@/lib/utils";
import type { Department, Asset, AssetType, Campaign, Project } from "@/types";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

// Files are stored inline as base64 in Firestore (no Storage/Blaze plan needed),
// so each asset must fit under Firestore's 1 MiB document cap.
const MAX_FILE_BYTES = 700 * 1024;

function detectType(file: File): AssetType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

const typeIcon: Record<AssetType, typeof ImageIcon> = { image: ImageIcon, video: Film, document: FileText };

type Tab = "departments" | "assets";

export default function DepartmentsPage() {
  const [tab, setTab] = useState<Tab>("departments");

  // ── Departments ────────────────────────────────────────────────────────────
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [deptError, setDeptError] = useState("");

  useEffect(() => subscribeDepartments((rows) => { setDepartments(rows); setDeptLoading(false); }), []);

  function openCreateDept() {
    setName("");
    setDescription("");
    setColor(COLORS[0]);
    setDeptError("");
    setDeptModalOpen(true);
  }

  async function handleSaveDept() {
    if (!name.trim()) {
      setDeptError("Department name is required");
      return;
    }
    try {
      await addDepartment({ name, description, color });
      setDeptModalOpen(false);
    } catch (err) {
      setDeptError("Failed to save. " + (err as Error).message);
    }
  }

  // ── Assets ─────────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<Asset[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetSearch, setAssetSearch] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState("");
  const [tags, setTags] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [assetError, setAssetError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeAssets((rows) => { setAssets(rows); setAssetsLoading(false); }),
      subscribeCampaigns(setCampaigns),
      subscribeProjects(setProjects),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filteredAssets = useMemo(
    () => assets.filter((a) =>
      a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(assetSearch.toLowerCase()))
    ),
    [assets, assetSearch]
  );

  async function handleUploadAsset() {
    if (!file) { setAssetError("Select a file"); return; }
    if (file.size > MAX_FILE_BYTES) {
      setAssetError(`File too large. Max ${Math.floor(MAX_FILE_BYTES / 1024)} KB (stored inline in Firestore).`);
      return;
    }
    setUploading(true); setAssetError("");
    try {
      const url = await fileToDataUrl(file);
      await addAsset({
        name: assetName || file.name, type: detectType(file), url, size: file.size,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        ...(campaignId ? { campaignId } : {}),
        ...(projectId ? { projectId } : {}),
      } as Omit<Asset, "id" | "createdAt">);
      setUploadOpen(false);
      setFile(null); setAssetName(""); setTags(""); setCampaignId(""); setProjectId("");
    } catch (err) {
      setAssetError("Upload failed. " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  usePageHeader({
    actions: tab === "departments" ? (
      <PrimaryButton onClick={openCreateDept}><Plus size={16} /> New Department</PrimaryButton>
    ) : (
      <PrimaryButton onClick={() => { setAssetError(""); setUploadOpen(true); }}><Upload size={16} /> Upload</PrimaryButton>
    ),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
        <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("departments")}
            className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "departments" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}
          >
            Departments
          </button>
          <button
            onClick={() => setTab("assets")}
            className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "assets" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}
          >
            Assets
          </button>
        </div>
      </div>

      {tab === "departments" ? (
        deptLoading ? (
          <LoadingState />
        ) : departments.length === 0 ? (
          <Card><EmptyState icon={Building2} label="No departments yet. Create one to start tagging work." /></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((d) => (
              <Card key={d.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <h3 className="font-semibold text-black">{d.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setDeptToDelete(d)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {d.description && <p className="text-sm text-neutral-500 mt-2">{d.description}</p>}
              </Card>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="mb-5"><SearchInput value={assetSearch} onChange={setAssetSearch} placeholder="Search by name or tag..." /></div>

          {assetsLoading ? (
            <LoadingState />
          ) : filteredAssets.length === 0 ? (
            <Card><EmptyState icon={ImageIcon} label="No assets yet" /></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAssets.map((a) => {
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
                        <button onClick={() => setAssetToDelete(a)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Department dialog */}
      <Dialog open={deptModalOpen} onOpenChange={setDeptModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" />
            </Field>
            <Field label="Description">
              <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Colour">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? "border-black" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </Field>
            {deptError && <p className="text-red-700 text-sm">{deptError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeptModalOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSaveDept}>Create</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Asset upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Upload Asset</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="File">
              <input type="file" className={inputClass} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !assetName) setAssetName(f.name); }} />
              <p className="text-xs text-neutral-400 mt-1">Max {Math.floor(MAX_FILE_BYTES / 1024)} KB</p>
            </Field>
            <Field label="Name"><input className={inputClass} value={assetName} onChange={(e) => setAssetName(e.target.value)} /></Field>
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
            {assetError && <p className="text-red-700 text-sm">{assetError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setUploadOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleUploadAsset} disabled={uploading}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload
              </PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!deptToDelete}
        onClose={() => setDeptToDelete(null)}
        onConfirm={async () => { if (deptToDelete) await deleteDepartment(deptToDelete.id); setDeptToDelete(null); }}
        title="Delete Department"
        description={`Delete "${deptToDelete?.name}"? This cannot be undone.`}
      />

      <DeleteConfirmModal
        isOpen={!!assetToDelete}
        onClose={() => setAssetToDelete(null)}
        onConfirm={async () => { if (assetToDelete) await deleteAsset(assetToDelete.id); setAssetToDelete(null); }}
        title="Delete Asset"
        description={`Delete "${assetToDelete?.name}"?`}
      />
    </div>
  );
}
