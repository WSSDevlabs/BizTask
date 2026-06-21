
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema } from "@/lib/validations";
import { addExpense, getExpenses, deleteExpense } from "@/lib/db";
import type { Expense } from "@/types";
import { z } from "zod";
import {
  Wallet,
  Plus,
  Loader2,
  CheckCircle,
  Receipt,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
  });

  async function fetchExpenses() {
    try {
      const data = await getExpenses();
      // Sort expenses by date descending
      setExpenses(data.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date.getTime() : 0;
        const dateB = b.date instanceof Date ? b.date.getTime() : 0;
        return dateB - dateA;
      }));
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchExpenses();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function confirmDelete(expense: Expense) {
    setExpenseToDelete(expense);
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!expenseToDelete) return;
    try {
      await deleteExpense(expenseToDelete.id);
      showToast(`Expense "${expenseToDelete.description}" deleted successfully`);
      await fetchExpenses();
    } catch (err) {
      console.error("Failed to delete expense:", err);
      alert("Failed to delete expense.");
    } finally {
      setDeleteModalOpen(false);
      setExpenseToDelete(null);
    }
  }

  async function onSubmit(data: ExpenseFormData) {
    setIsSubmitting(true);
    try {
      await addExpense({
        category: data.category,
        amount: data.amount,
        description: data.description,
      });
      reset();
      setDialogOpen(false);
      showToast("Expense Added Successfully");
      await fetchExpenses();
    } catch (err) {
      console.error("Failed to add expense:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Calculate total expenses over the list
  const totalExpensesAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl shadow-lg animate-in slide-in-from-right">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-black text-white p-2.5 rounded-xl">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black">Expenses</h1>
            <p className="text-sm text-neutral-500">
              {expenses.length} record{expenses.length !== 1 ? "s" : ""} • Total: <span className="font-semibold text-black">{formatCurrency(totalExpensesAmount)}</span>
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-red-900 focus:ring-offset-2">
              <Plus size={16} />
              Add Expense
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg bg-white border border-neutral-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-black">
                Add New Expense
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">
                    Category <span className="text-red-900/80">*</span>
                  </label>
                  <select
                    {...register("category")}
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                  >
                    <option value="">Select category</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.category && (
                    <p className="text-red-900/80 text-xs mt-1">{errors.category.message}</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1">
                    Amount (RM) <span className="text-red-900/80">*</span>
                  </label>
                  <input
                    {...register("amount", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                  />
                  {errors.amount && (
                    <p className="text-red-900/80 text-xs mt-1">{errors.amount.message}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  Description <span className="text-red-900/80">*</span>
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  placeholder="What was this expense for?"
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition resize-none"
                />
                {errors.description && (
                  <p className="text-red-900/80 text-xs mt-1">{errors.description.message}</p>
                )}
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
                    "Save Expense"
                  )}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-neutral-400" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <Receipt size={44} className="mx-auto mb-3 opacity-40" />
            <p>No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Date</th>
                  <th className="px-6 py-3.5 font-medium">Category</th>
                  <th className="px-6 py-3.5 font-medium">Description</th>
                  <th className="px-6 py-3.5 font-medium">Amount</th>
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
                {expenses.map((exp) => (
                  <motion.tr 
                    variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } }}}
                    key={exp.id} 
                    className="hover:bg-neutral-50/80 transition"
                  >
                    <td className="px-6 py-4 text-neutral-500 whitespace-nowrap">
                      {exp.date ? formatDate(exp.date) : "—"}
                    </td>
                    <td className="px-6 py-4 font-medium text-black">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {exp.description}
                    </td>
                    <td className="px-6 py-4 font-semibold text-red-800">
                      -{formatCurrency(exp.amount)}
                    </td>
                    <td className="px-6 py-4 flex items-center justify-end gap-2 text-right">
                      <button
                        onClick={() => confirmDelete(exp)}
                        title="Delete Expense"
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
        onClose={() => { setDeleteModalOpen(false); setExpenseToDelete(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Expense"
        description={`Are you sure you want to delete this expense record (${formatCurrency(expenseToDelete?.amount || 0)})?`}
      />
    </div>
  );
}
