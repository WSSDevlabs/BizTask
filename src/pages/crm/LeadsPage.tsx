import { useEffect, useMemo, useState } from "react";
import {
  Target, Plus, ChevronLeft, ChevronRight, Trash2, ArrowUpRight, Send,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, Field, inputClass, SearchInput,
} from "@/components/ui/shared";
import {
  subscribeLeads, addLead, updateLead, deleteLead, addDeal, subscribeCampaigns,
  subscribeActivitiesByLead, addActivity,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate } from "@/lib/utils";
import type { Lead, LeadStage, LeadSource, Campaign, Activity, ActivityType, Deal } from "@/types";

const STAGES: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
const SOURCES: LeadSource[] = ["Shopee", "TikTok", "WhatsApp", "FB", "IG", "Referral", "Cold Call", "Other"];
const ACTIVITY_TYPES: ActivityType[] = ["Call", "Meeting", "Email", "Follow-up", "Note"];

const stageColor: Record<LeadStage, string> = {
  New: "border-blue-300", Contacted: "border-amber-300", Qualified: "border-amber-400",
  Proposal: "border-purple-300", Negotiation: "border-orange-300", Won: "border-green-400", Lost: "border-red-300",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [toDelete, setToDelete] = useState<Lead | null>(null);

  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<LeadSource>("WhatsApp");
  const [stage, setStage] = useState<LeadStage>("New");
  const [expectedValue, setExpectedValue] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeLeads((rows) => { setLeads(rows); setLoading(false); }),
      subscribeCampaigns(setCampaigns),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filtered = useMemo(
    () => leads.filter((l) => l.company.toLowerCase().includes(search.toLowerCase()) || l.contactName.toLowerCase().includes(search.toLowerCase())),
    [leads, search]
  );

  function openCreate() {
    setEditing(null);
    setCompany(""); setContactName(""); setPhone(""); setEmail(""); setSource("WhatsApp");
    setStage("New"); setExpectedValue(""); setCampaignId(""); setNotes(""); setError(""); setFormOpen(true);
  }

  function openEdit(l: Lead) {
    setEditing(l);
    setCompany(l.company); setContactName(l.contactName); setPhone(l.phone ?? ""); setEmail(l.email ?? "");
    setSource(l.source); setStage(l.stage); setExpectedValue(l.expectedValue.toString());
    setCampaignId(l.campaignId ?? ""); setNotes(l.notes ?? ""); setError(""); setDetail(null); setFormOpen(true);
  }

  async function handleSave() {
    if (!company.trim() || !contactName.trim()) { setError("Company and contact name are required"); return; }
    const payload = {
      company, contactName, phone, email, source, stage,
      expectedValue: Number(expectedValue) || 0, campaignId: campaignId || undefined, notes,
    };
    try {
      if (editing) await updateLead(editing.id, payload);
      else await addLead(payload as Omit<Lead, "id" | "createdAt">);
      setFormOpen(false);
    } catch (err) { setError("Failed to save. " + (err as Error).message); }
  }

  async function moveLead(l: Lead, dir: -1 | 1) {
    const next = STAGES[STAGES.indexOf(l.stage) + dir];
    if (next) await updateLead(l.id, { stage: next });
  }

  async function convertToDeal(l: Lead) {
    await addDeal({
      title: `${l.company} deal`, leadId: l.id, value: l.expectedValue,
      stage: "Qualification", probability: 40,
    } as Omit<Deal, "id" | "createdAt">);
    await updateLead(l.id, { stage: "Proposal" });
    setDetail(null);
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        icon={Target}
        title="Leads"
        subtitle="Your sales pipeline"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Lead</PrimaryButton>}
      />

      <div className="mb-5"><SearchInput value={search} onChange={setSearch} placeholder="Search leads..." /></div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {STAGES.map((col) => {
          const colLeads = filtered.filter((l) => l.stage === col);
          const total = colLeads.reduce((s, l) => s + l.expectedValue, 0);
          return (
            <div key={col} className="bg-neutral-100 rounded-xl p-3 min-w-[240px] w-[240px] shrink-0">
              <div className="flex items-center justify-between mb-1 px-1">
                <h3 className="text-sm font-semibold text-neutral-700">{col}</h3>
                <span className="text-xs text-neutral-400 bg-white rounded-full px-2 py-0.5">{colLeads.length}</span>
              </div>
              <p className="px-1 mb-2 text-xs text-neutral-500">{formatCurrency(total)}</p>
              <div className="space-y-2">
                {colLeads.map((l) => (
                  <div key={l.id} onClick={() => setDetail(l)} className={cn("bg-white rounded-lg p-3 shadow-sm border-l-4 border border-neutral-200 cursor-pointer hover:shadow-md transition", stageColor[l.stage])}>
                    <p className="text-sm font-semibold text-black">{l.company}</p>
                    <p className="text-xs text-neutral-500">{l.contactName}</p>
                    <p className="text-xs text-red-800 font-medium mt-1">{formatCurrency(l.expectedValue)}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100">
                      <span className="text-[10px] text-neutral-400 uppercase">{l.source}</span>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button disabled={STAGES.indexOf(l.stage) === 0} onClick={() => moveLead(l, -1)} className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30"><ChevronLeft size={13} /></button>
                        <button disabled={STAGES.indexOf(l.stage) === STAGES.length - 1} onClick={() => moveLead(l, 1)} className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30"><ChevronRight size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Lead" : "New Lead"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company"><input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
              <Field label="Contact Name"><input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
              <Field label="Phone"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="Email"><input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Source">
                <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as LeadSource)}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Stage">
                <select className={inputClass} value={stage} onChange={(e) => setStage(e.target.value as LeadStage)}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Expected Value (RM)"><input type="number" className={inputClass} value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} /></Field>
              <Field label="Campaign">
                <select className={inputClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">None</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes"><textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {detail && (
        <LeadDetail
          lead={detail}
          onEdit={() => openEdit(detail)}
          onDelete={() => setToDelete(detail)}
          onConvert={() => convertToDeal(detail)}
          onClose={() => setDetail(null)}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteLead(toDelete.id); setToDelete(null); setDetail(null); }}
        title="Delete Lead"
        description={`Delete "${toDelete?.company}"?`}
      />
    </div>
  );
}

function LeadDetail({ lead, onEdit, onDelete, onConvert, onClose }: {
  lead: Lead; onEdit: () => void; onDelete: () => void; onConvert: () => void; onClose: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [type, setType] = useState<ActivityType>("Call");
  const [summary, setSummary] = useState("");

  useEffect(() => subscribeActivitiesByLead(lead.id, setActivities), [lead.id]);

  async function logActivity() {
    if (!summary.trim()) return;
    await addActivity({ leadId: lead.id, type, summary });
    setSummary("");
  }

  const sorted = [...activities].sort((a, b) => (toJsDate(b.createdAt)?.getTime() ?? 0) - (toJsDate(a.createdAt)?.getTime() ?? 0));
  const canConvert = ["Qualified", "Proposal", "Negotiation"].includes(lead.stage);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lead.company}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2 text-sm text-neutral-500">
            <p>Contact: <span className="text-black">{lead.contactName}</span></p>
            <p>Source: <span className="text-black">{lead.source}</span></p>
            <p>Phone: <span className="text-black">{lead.phone || "—"}</span></p>
            <p>Email: <span className="text-black">{lead.email || "—"}</span></p>
            <p>Stage: <span className="text-black">{lead.stage}</span></p>
            <p>Value: <span className="text-red-800 font-medium">{formatCurrency(lead.expectedValue)}</span></p>
          </div>
          {lead.notes && <p className="text-sm text-neutral-600 bg-neutral-50 rounded-lg p-3">{lead.notes}</p>}

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-sm font-semibold text-black mb-2">Activity Log</p>
            <div className="flex gap-2 mb-2">
              <select className={cn(inputClass, "max-w-[120px]")} value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className={inputClass} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Log a call, meeting..." onKeyDown={(e) => e.key === "Enter" && logActivity()} />
              <PrimaryButton onClick={logActivity}><Send size={15} /></PrimaryButton>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {sorted.map((a) => (
                <div key={a.id} className="text-sm bg-neutral-50 rounded-lg p-2">
                  <span className="font-medium text-red-800">{a.type}</span> · <span className="text-neutral-700">{a.summary}</span>
                  <span className="text-xs text-neutral-400 block">{a.createdAt ? formatDate(toJsDate(a.createdAt)!) : ""}</span>
                </div>
              ))}
              {sorted.length === 0 && <p className="text-xs text-neutral-400">No activity logged.</p>}
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-neutral-200">
            <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"><Trash2 size={15} /> Delete</button>
            <div className="flex gap-2">
              {canConvert && <button onClick={onConvert} className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg"><ArrowUpRight size={15} /> Convert to Deal</button>}
              <PrimaryButton onClick={onEdit}>Edit</PrimaryButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
