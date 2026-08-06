
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerSchema } from "@/lib/validations";
import { addCustomer, getCustomers, deleteCustomer } from "@/lib/db";
import type { Customer } from "@/types";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserPlus,
  Search,
  Building,
  Loader2,
  Phone,
  Mail,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { PrimaryButton } from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";

type CustomerFormData = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  });

  async function fetchCustomers() {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Show toast then auto-hide
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function confirmDelete(customer: Customer) {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!customerToDelete) return;
    try {
      await deleteCustomer(customerToDelete.id);
      showToast(`Customer "${customerToDelete.company}" deleted successfully`);
      await fetchCustomers();
    } catch (err) {
      console.error("Failed to delete customer:", err);
      alert("Failed to delete customer.");
    } finally {
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
    }
  }

  async function onSubmit(data: CustomerFormData) {
    setIsSubmitting(true);
    try {
      await addCustomer({
        name: data.name || "",
        company: data.company,
        email: data.email,
        phone: data.phone,
        address: data.address || "",
        ...(data.businessRegNumber ? { businessRegNumber: data.businessRegNumber } : {}),
      });
      reset();
      setDialogOpen(false);
      showToast("Customer Added Successfully");
      await fetchCustomers();
    } catch (err) {
      console.error("Failed to add customer:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter customers by company name
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    return customers.filter((c) =>
      c.company.toLowerCase().includes(search.toLowerCase())
    );
  }, [customers, search]);

  usePageHeader({ actions: <PrimaryButton onClick={() => setDialogOpen(true)}><UserPlus size={16} /> Add Customer</PrimaryButton> });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl shadow-lg animate-in slide-in-from-right">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-white border border-neutral-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-black">
                Add New Customer
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  Company Name <span className="text-red-900/80">*</span>
                </label>
                <input
                  {...register("company")}
                  placeholder="e.g. Syarikat Mega Sdn Bhd"
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                />
                {errors.company && (
                  <p className="text-red-900/80 text-xs mt-1">{errors.company.message}</p>
                )}
              </div>

              {/* Tax ID */}
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  Tax Identification Number <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  {...register("name")}
                  placeholder="e.g. C1234567890"
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                />
                {errors.name && (
                  <p className="text-red-900/80 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Business Registration Number */}
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  Business Registration Number <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  {...register("businessRegNumber")}
                  placeholder="e.g. 202301012345 (SSM)"
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                />
                {errors.businessRegNumber && (
                  <p className="text-red-900/80 text-xs mt-1">{errors.businessRegNumber.message}</p>
                )}
              </div>

              {/* Email & Phone (side by side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">
                    Client Email <span className="text-red-900/80">*</span>
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="email@company.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                  />
                  {errors.email && (
                    <p className="text-red-900/80 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">
                    Phone Number <span className="text-red-900/80">*</span>
                  </label>
                  <input
                    {...register("phone")}
                    placeholder="e.g. 012-3456789"
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                  />
                  {errors.phone && (
                    <p className="text-red-900/80 text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  Office Address
                </label>
                <textarea
                  {...register("address")}
                  rows={2}
                  placeholder="Full office address"
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-black transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-800 hover:bg-red-900 disabled:bg-neutral-400 text-white font-medium rounded-lg transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Customer"
                  )}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      {/* Search Bar */}
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-black placeholder-neutral-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
          />
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-neutral-400" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <Building size={44} className="mx-auto mb-3 opacity-40" />
            <p>{search ? "No customers match your search." : "No customers yet. Add your first client!"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Company</th>
                  <th className="px-6 py-3.5 font-medium">SSM Number</th>
                  <th className="px-6 py-3.5 font-medium">Email</th>
                  <th className="px-6 py-3.5 font-medium">Phone</th>
                  <th className="px-6 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody 
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.15 } }
                }}
                className="divide-y divide-neutral-100"
              >
                {filteredCustomers.map((c) => (
                  <motion.tr 
                    variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } }}}
                    key={c.id} 
                    className="hover:bg-neutral-50/80 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-neutral-200 text-black flex items-center justify-center text-xs font-bold shrink-0">
                          {c.company.charAt(0).toUpperCase()}
                        </div>
                      <span className="font-semibold text-black">
                          {c.company}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-700 font-medium">
                      {c.businessRegNumber || "—"}
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={13} className="text-neutral-400" />
                        {c.email || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={13} className="text-neutral-400" />
                        {c.phone}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => confirmDelete(c)}
                        title="Delete Customer"
                        className="p-2 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setCustomerToDelete(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        description={`Are you sure you want to delete ${customerToDelete?.company}?`}
      />
    </div>
  );
}
