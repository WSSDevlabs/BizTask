import { useEffect, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
} from "@/components/ui/shared";
import {
  subscribeCampaigns, addCampaign, updateCampaign, deleteCampaign,
} from "@/lib/db";
import { formatCurrency, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type { Campaign, CampaignChannel, CampaignMetric } from "@/types";

const CHANNELS: CampaignChannel[] = ["Shopee", "TikTok Shop", "WhatsApp", "FB", "IG", "Email", "Google"];

const emptyMetrics: CampaignMetric = { reach: 0, clicks: 0, conversions: 0, revenue: 0 };

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [metricsFor, setMetricsFor] = useState<Campaign | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [toDelete, setToDelete] = useState<Campaign | null>(null);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("FB");
  const [budget, setBudget] = useState("");
  const [spend, setSpend] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  // metrics form
  const [reach, setReach] = useState("0");
  const [clicks, setClicks] = useState("0");
  const [conversions, setConversions] = useState("0");
  const [revenue, setRevenue] = useState("0");

  useEffect(() => {
    const unsub = subscribeCampaigns((rows) => { setCampaigns(rows); setLoading(false); });
    return unsub;
  }, []);

  function openCreate() {
    setEditing(null);
    setName(""); setChannel("FB"); setBudget(""); setSpend(""); setStartDate(""); setEndDate(""); setDescription(""); setError(""); setModalOpen(true);
  }
  function openEdit(c: Campaign) {
    setEditing(c);
    setName(c.name); setChannel(c.channel); setBudget(c.budget.toString()); setSpend(c.spend.toString());
    setStartDate(toDateInputValue(c.startDate)); setEndDate(toDateInputValue(c.endDate)); setDescription(c.description ?? ""); setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    const payload = {
      name, channel, budget: Number(budget) || 0, spend: Number(spend) || 0,
      startDate: dateStringToTimestamp(startDate), endDate: dateStringToTimestamp(endDate),
      description,
    };
    try {
      if (editing) await updateCampaign(editing.id, payload);
      else await addCampaign({ ...payload, metrics: emptyMetrics } as Omit<Campaign, "id" | "createdAt">);
      setModalOpen(false);
    } catch (err) { setError("Failed to save. " + (err as Error).message); }
  }

  function openMetrics(c: Campaign) {
    setMetricsFor(c);
    setReach(c.metrics.reach.toString()); setClicks(c.metrics.clicks.toString());
    setConversions(c.metrics.conversions.toString()); setRevenue(c.metrics.revenue.toString());
  }
  async function saveMetrics() {
    if (!metricsFor) return;
    await updateCampaign(metricsFor.id, {
      metrics: { reach: Number(reach) || 0, clicks: Number(clicks) || 0, conversions: Number(conversions) || 0, revenue: Number(revenue) || 0 },
    });
    setMetricsFor(null);
  }

  function roi(c: Campaign): number {
    if (c.spend === 0) return 0;
    return Math.round(((c.metrics.revenue - c.spend) / c.spend) * 100);
  }
  function costPerConversion(c: Campaign): number {
    return c.metrics.conversions === 0 ? 0 : c.spend / c.metrics.conversions;
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={Megaphone}
        title="Campaigns"
        subtitle="Marketing performance tracking"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Campaign</PrimaryButton>}
      />

      {campaigns.length === 0 ? (
        <Card><EmptyState icon={Megaphone} label="No campaigns yet" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => {
            const r = roi(c);
            return (
              <Card key={c.id} className="p-5 group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-black">{c.name}</p>
                    <span className="text-xs text-neutral-400 uppercase">{c.channel}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                    <button onClick={() => setToDelete(c)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
                  <div><p className="text-neutral-400 text-xs">Budget</p><p className="text-black font-medium">{formatCurrency(c.budget)}</p></div>
                  <div><p className="text-neutral-400 text-xs">Spend</p><p className="text-black font-medium">{formatCurrency(c.spend)}</p></div>
                  <div><p className="text-neutral-400 text-xs">Conversions</p><p className="text-black font-medium">{c.metrics.conversions}</p></div>
                  <div><p className="text-neutral-400 text-xs">Revenue</p><p className="text-black font-medium">{formatCurrency(c.metrics.revenue)}</p></div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-neutral-100">
                  <span className={`text-sm font-semibold ${r >= 0 ? "text-green-600" : "text-red-600"}`}>ROI {r}%</span>
                  <span className="text-xs text-neutral-500">{formatCurrency(costPerConversion(c))}/conv</span>
                  <button onClick={() => openMetrics(c)} className="text-xs text-red-800 hover:underline flex items-center gap-1"><BarChart3 size={13} /> Metrics</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Channel">
                <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as CampaignChannel)}>
                  {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                </select>
              </Field>
              <Field label="Budget (RM)"><input type="number" className={inputClass} value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
              <Field label="Spend (RM)"><input type="number" className={inputClass} value={spend} onChange={(e) => setSpend(e.target.value)} /></Field>
              <Field label="Start Date"><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="End Date"><input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
            </div>
            <Field label="Description"><textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metrics */}
      <Dialog open={!!metricsFor} onOpenChange={(o) => !o && setMetricsFor(null)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Record Metrics — {metricsFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reach"><input type="number" className={inputClass} value={reach} onChange={(e) => setReach(e.target.value)} /></Field>
              <Field label="Clicks"><input type="number" className={inputClass} value={clicks} onChange={(e) => setClicks(e.target.value)} /></Field>
              <Field label="Conversions"><input type="number" className={inputClass} value={conversions} onChange={(e) => setConversions(e.target.value)} /></Field>
              <Field label="Revenue (RM)"><input type="number" className={inputClass} value={revenue} onChange={(e) => setRevenue(e.target.value)} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMetricsFor(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={saveMetrics}>Save Metrics</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteCampaign(toDelete.id); setToDelete(null); }}
        title="Delete Campaign"
        description={`Delete "${toDelete?.name}"?`}
      />
    </div>
  );
}
