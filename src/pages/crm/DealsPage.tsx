import { useEffect, useMemo, useState } from "react";
import { Handshake, Plus, Pencil, Trash2, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, StatCard,
} from "@/components/ui/shared";
import {
  subscribeDeals, addDeal, updateDeal, deleteDeal, subscribeLeads, subscribeCustomers,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type { Deal, DealStage, Lead, Customer } from "@/types";

const STAGES: DealStage[] = ["Qualification", "Proposal", "Negotiation", "Closing", "Won", "Lost"];

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [toDelete, setToDelete] = useState<Deal | null>(null);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>("Qualification");
  const [probability, setProbability] = useState("50");
  const [closeDate, setCloseDate] = useState("");
  const [leadId, setLeadId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeDeals((rows) => { setDeals(rows); setLoading(false); }),
      subscribeLeads(setLeads),
      subscribeCustomers(setCustomers),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filtered = useMemo(() => deals.filter((d) => !filterStage || d.stage === filterStage), [deals, filterStage]);

  const openDeals = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
  const weighted = openDeals.reduce((s, d) => s + d.value * (d.probability / 100), 0);
  const wonValue = deals.filter((d) => d.stage === "Won").reduce((s, d) => s + d.value, 0);

  function openCreate() {
    setEditing(null);
    setTitle(""); setValue(""); setStage("Qualification"); setProbability("50");
    setCloseDate(""); setLeadId(""); setCustomerId(""); setError(""); setModalOpen(true);
  }
  function openEdit(d: Deal) {
    setEditing(d);
    setTitle(d.title); setValue(d.value.toString()); setStage(d.stage); setProbability(d.probability.toString());
    setCloseDate(toDateInputValue(d.expectedCloseDate)); setLeadId(d.leadId ?? ""); setCustomerId(d.customerId ?? "");
    setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    const payload = {
      title, value: Number(value) || 0, stage, probability: Number(probability) || 0,
      expectedCloseDate: dateStringToTimestamp(closeDate),
      leadId: leadId || undefined, customerId: customerId || undefined,
    };
    try {
      if (editing) await updateDeal(editing.id, payload);
      else await addDeal(payload as Omit<Deal, "id" | "createdAt">);
      setModalOpen(false);
    } catch (err) { setError("Failed to save. " + (err as Error).message); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={Handshake}
        title="Deals"
        subtitle="Opportunities and revenue forecast"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Deal</PrimaryButton>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} icon={TrendingUp} hint={`${openDeals.length} open deals`} />
        <StatCard label="Weighted Forecast" value={formatCurrency(weighted)} icon={TrendingUp} hint="Probability-adjusted" accent />
        <StatCard label="Won This Period" value={formatCurrency(wonValue)} icon={Handshake} hint={`${deals.filter((d) => d.stage === "Won").length} closed`} />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterStage("")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!filterStage ? "bg-black text-white" : "bg-white border border-neutral-200 text-neutral-600"}`}>All</button>
        {STAGES.map((s) => (
          <button key={s} onClick={() => setFilterStage(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterStage === s ? "bg-black text-white" : "bg-white border border-neutral-200 text-neutral-600"}`}>{s}</button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Handshake} label="No deals yet" />
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
              <tr>
                <th className="px-5 py-3 font-medium">Deal</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 font-medium">Probability</th>
                <th className="px-5 py-3 font-medium">Close Date</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3 font-medium text-black">{d.title}</td>
                  <td className="px-5 py-3 font-semibold text-black">{formatCurrency(d.value)}</td>
                  <td className="px-5 py-3"><StatusBadge label={d.stage} tone={toneForStatus(d.stage)} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-red-800" style={{ width: `${d.probability}%` }} /></div>
                      <span className="text-neutral-600 text-xs">{d.probability}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">{d.expectedCloseDate ? formatDate(toJsDate(d.expectedCloseDate)!) : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {d.stage !== "Won" && d.stage !== "Lost" && (
                        <>
                          <button onClick={() => updateDeal(d.id, { stage: "Won", probability: 100 })} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100">Win</button>
                          <button onClick={() => updateDeal(d.id, { stage: "Lost", probability: 0 })} className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100">Lose</button>
                        </>
                      )}
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                      <button onClick={() => setToDelete(d)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Value (RM)"><input type="number" className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} /></Field>
              <Field label="Stage">
                <select className={inputClass} value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Probability (%)"><input type="number" min={0} max={100} className={inputClass} value={probability} onChange={(e) => setProbability(e.target.value)} /></Field>
              <Field label="Expected Close"><input type="date" className={inputClass} value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></Field>
              <Field label="Linked Lead">
                <select className={inputClass} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                  <option value="">None</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.company}</option>)}
                </select>
              </Field>
              <Field label="Linked Customer">
                <select className={cn(inputClass)} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">None</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </Field>
            </div>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteDeal(toDelete.id); setToDelete(null); }}
        title="Delete Deal"
        description={`Delete "${toDelete?.title}"?`}
      />
    </div>
  );
}
