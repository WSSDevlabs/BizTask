import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, ChevronLeft, ChevronRight, Trash2, ArrowUpRight, Send, Pencil, Handshake, TrendingUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass, SearchInput,
  StatusBadge, toneForStatus, StatCard,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeLeads, addLead, updateLead, deleteLead, addDeal, subscribeCampaigns,
  subscribeActivitiesByLead, addActivity,
  subscribeDeals, updateDeal, deleteDeal, subscribeCustomers,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type {
  Lead, LeadStage, LeadSource, Campaign, Activity, ActivityType, Deal, DealStage, Customer,
} from "@/types";

type Tab = "leads" | "deals";

const LEAD_STAGES: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
const SOURCES: LeadSource[] = ["Shopee", "TikTok", "WhatsApp", "FB", "IG", "Referral", "Cold Call", "Other"];
const ACTIVITY_TYPES: ActivityType[] = ["Call", "Meeting", "Email", "Follow-up", "Note"];
const DEAL_STAGES: DealStage[] = ["Qualification", "Proposal", "Negotiation", "Closing", "Won", "Lost"];

const stageColor: Record<LeadStage, string> = {
  New: "border-blue-300", Contacted: "border-amber-300", Qualified: "border-amber-400",
  Proposal: "border-purple-300", Negotiation: "border-orange-300", Won: "border-green-400", Lost: "border-red-300",
};

export default function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("leads");

  // ── Leads ────────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");

  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadDetail, setLeadDetail] = useState<Lead | null>(null);
  const [leadEditing, setLeadEditing] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<LeadSource>("WhatsApp");
  const [leadStage, setLeadStage] = useState<LeadStage>("New");
  const [expectedValue, setExpectedValue] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [notes, setNotes] = useState("");
  const [leadError, setLeadError] = useState("");

  // ── Deals ────────────────────────────────────────────────────────────────
  const [deals, setDeals] = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dealsLoaded, setDealsLoaded] = useState(false);
  const [dealFilterStage, setDealFilterStage] = useState("");

  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [dealEditing, setDealEditing] = useState<Deal | null>(null);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealStage, setDealStage] = useState<DealStage>("Qualification");
  const [dealProbability, setDealProbability] = useState("50");
  const [dealCloseDate, setDealCloseDate] = useState("");
  const [dealLeadId, setDealLeadId] = useState("");
  const [dealCustomerId, setDealCustomerId] = useState("");
  const [dealError, setDealError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeLeads((rows) => { setLeads(rows); setLeadsLoaded(true); }),
      subscribeCampaigns(setCampaigns),
      subscribeDeals((rows) => { setDeals(rows); setDealsLoaded(true); }),
      subscribeCustomers(setCustomers),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const loading = !(leadsLoaded && dealsLoaded);

  const leadsFiltered = useMemo(
    () => leads.filter((l) => l.company.toLowerCase().includes(leadSearch.toLowerCase()) || l.contactName.toLowerCase().includes(leadSearch.toLowerCase())),
    [leads, leadSearch]
  );

  function leadOpenCreate() {
    setLeadEditing(null);
    setCompany(""); setContactName(""); setPhone(""); setEmail(""); setSource("WhatsApp");
    setLeadStage("New"); setExpectedValue(""); setCampaignId(""); setNotes(""); setLeadError(""); setLeadFormOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      leadOpenCreate();
      setSearchParams((p) => { p.delete("action"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function leadOpenEdit(l: Lead) {
    setLeadEditing(l);
    setCompany(l.company); setContactName(l.contactName); setPhone(l.phone ?? ""); setEmail(l.email ?? "");
    setSource(l.source); setLeadStage(l.stage); setExpectedValue(l.expectedValue.toString());
    setCampaignId(l.campaignId ?? ""); setNotes(l.notes ?? ""); setLeadError(""); setLeadDetail(null); setLeadFormOpen(true);
  }

  async function leadHandleSave() {
    if (!company.trim() || !contactName.trim()) { setLeadError("Company and contact name are required"); return; }
    const payload = {
      company, contactName, phone, email, source, stage: leadStage, notes,
      expectedValue: Number(expectedValue) || 0,
      ...(campaignId ? { campaignId } : {}),
    };
    try {
      if (leadEditing) await updateLead(leadEditing.id, payload);
      else await addLead(payload as Omit<Lead, "id" | "createdAt">);
      setLeadFormOpen(false);
    } catch (err) { setLeadError("Failed to save. " + (err as Error).message); }
  }

  async function moveLead(l: Lead, dir: -1 | 1) {
    const next = LEAD_STAGES[LEAD_STAGES.indexOf(l.stage) + dir];
    if (next) await updateLead(l.id, { stage: next });
  }

  async function convertToDeal(l: Lead) {
    await addDeal({
      title: `${l.company} deal`, leadId: l.id, value: l.expectedValue,
      stage: "Qualification", probability: 40,
    } as Omit<Deal, "id" | "createdAt">);
    await updateLead(l.id, { stage: "Proposal" });
    setLeadDetail(null);
    setTab("deals");
  }

  // ── Deals logic ──────────────────────────────────────────────────────────

  const dealsFiltered = useMemo(() => deals.filter((d) => !dealFilterStage || d.stage === dealFilterStage), [deals, dealFilterStage]);

  const openDeals = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
  const weighted = openDeals.reduce((s, d) => s + d.value * (d.probability / 100), 0);
  const wonValue = deals.filter((d) => d.stage === "Won").reduce((s, d) => s + d.value, 0);

  const valueByStage = useMemo(
    () => DEAL_STAGES.map((s) => ({ stage: s, value: deals.filter((d) => d.stage === s).reduce((sum, d) => sum + d.value, 0) })),
    [deals]
  );
  const maxStageValue = Math.max(1, ...valueByStage.map((s) => s.value));

  function dealOpenCreate() {
    setDealEditing(null);
    setDealTitle(""); setDealValue(""); setDealStage("Qualification"); setDealProbability("50");
    setDealCloseDate(""); setDealLeadId(""); setDealCustomerId(""); setDealError(""); setDealModalOpen(true);
  }
  function dealOpenEdit(d: Deal) {
    setDealEditing(d);
    setDealTitle(d.title); setDealValue(d.value.toString()); setDealStage(d.stage); setDealProbability(d.probability.toString());
    setDealCloseDate(toDateInputValue(d.expectedCloseDate)); setDealLeadId(d.leadId ?? ""); setDealCustomerId(d.customerId ?? "");
    setDealError(""); setDealModalOpen(true);
  }

  async function dealHandleSave() {
    if (!dealTitle.trim()) { setDealError("Title is required"); return; }
    const payload = {
      title: dealTitle, value: Number(dealValue) || 0, stage: dealStage, probability: Number(dealProbability) || 0,
      ...(dealCloseDate ? { expectedCloseDate: dateStringToTimestamp(dealCloseDate) } : {}),
      ...(dealLeadId ? { leadId: dealLeadId } : {}),
      ...(dealCustomerId ? { customerId: dealCustomerId } : {}),
    };
    try {
      if (dealEditing) await updateDeal(dealEditing.id, payload);
      else await addDeal(payload as Omit<Deal, "id" | "createdAt">);
      setDealModalOpen(false);
    } catch (err) { setDealError("Failed to save. " + (err as Error).message); }
  }

  usePageHeader({
    actions: tab === "leads"
      ? <PrimaryButton onClick={leadOpenCreate}><Plus size={16} /> New Lead</PrimaryButton>
      : <PrimaryButton onClick={dealOpenCreate}><Plus size={16} /> New Deal</PrimaryButton>,
  });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-xl p-1 mb-6">
        <button onClick={() => setTab("leads")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "leads" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Leads</button>
        <button onClick={() => setTab("deals")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "deals" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Deals</button>
      </div>

      {tab === "leads" && (
        <>
          <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
            <div className="mb-1"><SearchInput value={leadSearch} onChange={setLeadSearch} placeholder="Search leads..." /></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {LEAD_STAGES.map((col) => {
              const colLeads = leadsFiltered.filter((l) => l.stage === col);
              const total = colLeads.reduce((s, l) => s + l.expectedValue, 0);
              return (
                <div key={col} className="bg-neutral-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1 px-1">
                    <h3 className="text-sm font-semibold text-neutral-700">{col}</h3>
                    <span className="text-xs text-neutral-400 bg-white rounded-full px-2 py-0.5">{colLeads.length}</span>
                  </div>
                  <p className="px-1 mb-2 text-xs text-neutral-500">{formatCurrency(total)}</p>
                  <div className="space-y-2">
                    {colLeads.map((l) => (
                      <div key={l.id} onClick={() => setLeadDetail(l)} className={cn("bg-white rounded-lg p-3 shadow-sm border-l-4 border border-neutral-200 cursor-pointer hover:shadow-md transition", stageColor[l.stage])}>
                        <p className="text-sm font-semibold text-black">{l.company}</p>
                        <p className="text-xs text-neutral-500">{l.contactName}</p>
                        <p className="text-xs text-red-800 font-medium mt-1">{formatCurrency(l.expectedValue)}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100">
                          <span className="text-[10px] text-neutral-400 uppercase">{l.source}</span>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button disabled={LEAD_STAGES.indexOf(l.stage) === 0} onClick={() => moveLead(l, -1)} className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30"><ChevronLeft size={13} /></button>
                            <button disabled={LEAD_STAGES.indexOf(l.stage) === LEAD_STAGES.length - 1} onClick={() => moveLead(l, 1)} className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30"><ChevronRight size={13} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "deals" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} icon={TrendingUp} hint={`${openDeals.length} open deals`} tone="blue" />
            <StatCard label="Weighted Forecast" value={formatCurrency(weighted)} icon={TrendingUp} hint="Probability-adjusted" tone="amber" />
            <StatCard label="Won This Period" value={formatCurrency(wonValue)} icon={Handshake} hint={`${deals.filter((d) => d.stage === "Won").length} closed`} tone="emerald" />
          </div>

          <Card className="p-5 mb-6">
            <h2 className="font-semibold text-black mb-4">Pipeline by Stage</h2>
            <div className="space-y-3">
              {valueByStage.map((s) => (
                <div key={s.stage}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-neutral-600">{s.stage}</span><span className="font-medium text-black">{formatCurrency(s.value)}</span></div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-sky-600 rounded-full" style={{ width: `${(s.value / maxStageValue) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setDealFilterStage("")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!dealFilterStage ? "bg-black text-white" : "bg-white border border-neutral-200 text-neutral-600"}`}>All</button>
            {DEAL_STAGES.map((s) => (
              <button key={s} onClick={() => setDealFilterStage(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${dealFilterStage === s ? "bg-black text-white" : "bg-white border border-neutral-200 text-neutral-600"}`}>{s}</button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {dealsFiltered.length === 0 ? (
              <EmptyState icon={Handshake} label="No deals yet" />
            ) : (
              <div className="overflow-x-auto">
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
                    {dealsFiltered.map((d) => (
                      <tr key={d.id} className="hover:bg-neutral-50">
                        <td className="px-5 py-3 font-medium text-black">{d.title}</td>
                        <td className="px-5 py-3 font-semibold text-black">{formatCurrency(d.value)}</td>
                        <td className="px-5 py-3"><StatusBadge label={d.stage} tone={toneForStatus(d.stage)} /></td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden"><div className={cn("h-full", d.probability >= 70 ? "bg-emerald-500" : d.probability >= 40 ? "bg-amber-500" : "bg-red-600")} style={{ width: `${d.probability}%` }} /></div>
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
                            <button onClick={() => dealOpenEdit(d)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                            <button onClick={() => setDealToDelete(d)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Lead form ──────────────────────────────────────────────────────── */}
      <Dialog open={leadFormOpen} onOpenChange={setLeadFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{leadEditing ? "Edit Lead" : "New Lead"}</DialogTitle></DialogHeader>
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
                <select className={inputClass} value={leadStage} onChange={(e) => setLeadStage(e.target.value as LeadStage)}>
                  {LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            {leadError && <p className="text-red-700 text-sm">{leadError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setLeadFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={leadHandleSave}>{leadEditing ? "Save" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {leadDetail && (
        <LeadDetail
          lead={leadDetail}
          onEdit={() => leadOpenEdit(leadDetail)}
          onDelete={() => setLeadToDelete(leadDetail)}
          onConvert={() => convertToDeal(leadDetail)}
          onClose={() => setLeadDetail(null)}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!leadToDelete}
        onClose={() => setLeadToDelete(null)}
        onConfirm={async () => { if (leadToDelete) await deleteLead(leadToDelete.id); setLeadToDelete(null); setLeadDetail(null); }}
        title="Delete Lead"
        description={`Delete "${leadToDelete?.company}"?`}
      />

      {/* ── Deal form ──────────────────────────────────────────────────────── */}
      <Dialog open={dealModalOpen} onOpenChange={setDealModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dealEditing ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Title"><input className={inputClass} value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Value (RM)"><input type="number" className={inputClass} value={dealValue} onChange={(e) => setDealValue(e.target.value)} /></Field>
              <Field label="Stage">
                <select className={inputClass} value={dealStage} onChange={(e) => setDealStage(e.target.value as DealStage)}>
                  {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Probability (%)"><input type="number" min={0} max={100} className={inputClass} value={dealProbability} onChange={(e) => setDealProbability(e.target.value)} /></Field>
              <Field label="Expected Close"><input type="date" className={inputClass} value={dealCloseDate} onChange={(e) => setDealCloseDate(e.target.value)} /></Field>
              <Field label="Linked Lead">
                <select className={inputClass} value={dealLeadId} onChange={(e) => setDealLeadId(e.target.value)}>
                  <option value="">None</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.company}</option>)}
                </select>
              </Field>
              <Field label="Linked Customer">
                <select className={inputClass} value={dealCustomerId} onChange={(e) => setDealCustomerId(e.target.value)}>
                  <option value="">None</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </Field>
            </div>
            {dealError && <p className="text-red-700 text-sm">{dealError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDealModalOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={dealHandleSave}>{dealEditing ? "Save" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!dealToDelete}
        onClose={() => setDealToDelete(null)}
        onConfirm={async () => { if (dealToDelete) await deleteDeal(dealToDelete.id); setDealToDelete(null); }}
        title="Delete Deal"
        description={`Delete "${dealToDelete?.title}"?`}
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
