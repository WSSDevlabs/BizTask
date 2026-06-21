
import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { getCustomers, createOrder, getOrders, updateOrder, deleteOrder } from "@/lib/db";
import { calculateOrderTotals, formatCurrency, formatDate } from "@/lib/utils";
import type { Customer, Order } from "@/types";
import DownloadButton from "@/components/pdf/DownloadButton";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Search,
  X,
  CheckCircle,
  UserPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

interface OrderFormData {
  customerId: string;
  status: "Draft" | "Quoted" | "Partially Paid" | "Paid" | "Cancelled";
  discount: number;
  shippingCost: number;
  deposit: number;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

const statusColors: Record<string, string> = {
  Draft: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  Quoted: "bg-black text-white",
  "Partially Paid": "bg-orange-500 text-white",
  Paid: "bg-red-800 text-white",
  Cancelled: "bg-white text-red-800 border border-red-800",
};

export default function OrdersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  // New Customer Inline State
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", company: "", email: "", phone: "", address: "" });

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentType, setPaymentType] = useState<"Full" | "Partial">("Full");
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrderFormData>({
    defaultValues: {
      customerId: "",
      status: "Draft",
      discount: 0,
      shippingCost: 0,
      deposit: 0,
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const watchedDiscount = watch("discount");
  const watchedShippingCost = watch("shippingCost");
  const watchedDeposit = watch("deposit");
  const watchedCustomerId = watch("customerId");

  const totals = calculateOrderTotals(
    (watchedItems || []).map((item, i) => ({
      id: String(i),
      description: item.description || "",
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    })),
    Number(watchedDiscount) || 0,
    Number(watchedShippingCost) || 0,
    Number(watchedDeposit) || 0
  );

  useEffect(() => {
    async function load() {
      try {
        const [customersData, ordersData] = await Promise.all([
          getCustomers(),
          getOrders(),
        ]);
        setCustomers(customersData);
        setOrders(ordersData);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function refreshCustomers() {
    try {
      const customersData = await getCustomers();
      setCustomers(customersData);
      return customersData;
    } catch (err) {
      console.error("Failed to refresh customers:", err);
      return customers;
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  const handleCustomerSearch = useCallback(
    (searchTerm: string) => {
      setCustomerSearch(searchTerm);
      if (searchTerm.trim() === "") {
        setFilteredCustomers([]);
        setShowDropdown(false);
        return;
      }
      const filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
      setShowDropdown(true);
    },
    [customers]
  );

  function selectCustomer(customer: Customer) {
    setValue("customerId", customer.id);
    setSelectedCustomerName(`${customer.name} — ${customer.company}`);
    setCustomerSearch("");
    setShowDropdown(false);
    setShowNewCustomerForm(false);
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomer.company || !newCustomer.phone) {
      alert("Company and Phone are required.");
      return;
    }

    setIsCreatingCustomer(true);
    try {
      // Import addCustomer dynamically to avoid changing top-level imports directly if not needed, 
      // but actually we should just add it to the top import. Wait, let me add it to the top import first.
      const { addCustomer } = await import("@/lib/db");
      const newId = await addCustomer(newCustomer);
      
      const updatedCustomers = await refreshCustomers();
      const createdCustomer = updatedCustomers.find(c => c.id === newId);
      
      if (createdCustomer) {
        selectCustomer(createdCustomer);
        showToast("Customer created and selected!");
      }
      
      setNewCustomer({ name: "", company: "", email: "", phone: "", address: "" });
      setShowNewCustomerForm(false);
    } catch (err) {
      console.error("Failed to create customer:", err);
      alert("Failed to create customer.");
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  // Get customer by ID
  function getCustomerById(customerId: string): Customer | undefined {
    return customers.find((cust) => cust.id === customerId);
  }

  function getCustomerName(customerId: string): string {
    const c = getCustomerById(customerId);
    return c ? `${c.name} (${c.company})` : customerId;
  }

  function openPaymentModal(order: Order) {
    setSelectedOrder(order);
    if (order.status === "Partially Paid") {
      setPaymentType("Full"); // Only option is to complete payment
    } else {
      setPaymentType("Full");
      setDepositAmount(0);
    }
    setShowPaymentModal(true);
  }

  async function handleProcessPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsProcessingPayment(true);
    try {
      if (paymentType === "Full" || selectedOrder.status === "Partially Paid") {
        // Complete the payment
        await updateOrder(selectedOrder.id, { status: "Paid" });
        showToast("Order marked as fully Paid!");
      } else {
        // Partial Payment
        if (depositAmount <= 0 || depositAmount >= selectedOrder.grandTotal) {
          alert("Deposit must be greater than 0 and less than Grand Total.");
          setIsProcessingPayment(false);
          return;
        }
        await updateOrder(selectedOrder.id, { 
          status: "Partially Paid", 
          deposit: depositAmount 
        });
        showToast("Order marked as Partially Paid with deposit recorded!");
      }

      setShowPaymentModal(false);
      const updatedOrders = await getOrders();
      setOrders(updatedOrders);
    } catch (err) {
      console.error("Failed to process payment:", err);
      alert("Failed to update payment status.");
    } finally {
      setIsProcessingPayment(false);
    }
  }

  function confirmDelete(order: Order) {
    setOrderToDelete(order);
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!orderToDelete) return;
    try {
      await deleteOrder(orderToDelete.id);
      showToast("Order deleted successfully!");
      const updatedOrders = await getOrders();
      setOrders(updatedOrders);
    } catch (err) {
      console.error("Failed to delete order:", err);
      alert("Failed to delete order.");
    } finally {
      setDeleteModalOpen(false);
      setOrderToDelete(null);
    }
  }

  async function onSubmit(data: OrderFormData) {
    if (!data.customerId) return;
    if (totals.grandTotal <= 0) return;

    setIsSubmitting(true);
    try {
      const orderItems = data.items.map((item, i) => ({
        id: String(i + 1),
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.quantity) * Number(item.unitPrice),
      }));

      const calculated = calculateOrderTotals(
        orderItems, 
        Number(data.discount),
        Number(data.shippingCost),
        Number(data.deposit)
      );

      await createOrder({
        customerId: data.customerId,
        status: data.status,
        items: orderItems,
        subtotal: calculated.subtotal,
        discount: calculated.discount,
        shippingCost: calculated.shippingCost,
        grandTotal: calculated.grandTotal,
        deposit: calculated.deposit,
      });

      showToast("Order created successfully!");
      reset();
      setSelectedCustomerName("");
      setShowForm(false);

      // Refresh orders
      const updatedOrders = await getOrders();
      setOrders(updatedOrders);
    } catch (err) {
      console.error("Failed to create order:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl shadow-lg">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-black text-white p-2.5 rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black">Orders</h1>
            <p className="text-sm text-neutral-500">
              {orders.length} order{orders.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-red-900 focus:ring-offset-2"
          >
            <Plus size={16} />
            Create New Order
          </button>
        )}
      </div>

      {/* Create Order Form (Full-width panel) */}
      {showForm && (
        <div className="mb-8 bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
            <h2 className="text-lg font-semibold text-black">
              New Order
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                reset();
                setSelectedCustomerName("");
              }}
              className="p-1.5 text-neutral-400 hover:text-black transition"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Customer & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Searchable Customer */}
              <div className="relative">
                <label className="block text-sm font-medium text-neutral-600 mb-1.5">
                  Customer <span className="text-red-900/80">*</span>
                </label>
                {selectedCustomerName ? (
                  <div className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-neutral-100 text-black">
                    <span className="text-sm font-medium">{selectedCustomerName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setValue("customerId", "");
                        setSelectedCustomerName("");
                      }}
                      className="text-neutral-400 hover:text-red-800 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => handleCustomerSearch(e.target.value)}
                        onFocus={() => customerSearch && setShowDropdown(true)}
                        placeholder="Search by name or company..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                      />
                    </div>
                    {showDropdown && !showNewCustomerForm && (
                      <ul className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.length > 0 ? (
                          <>
                            {filteredCustomers.map((c) => (
                              <li
                                key={c.id}
                                onClick={() => selectCustomer(c)}
                                className="px-4 py-2.5 hover:bg-neutral-50 cursor-pointer text-sm text-black border-b border-neutral-100"
                              >
                                <span className="font-medium">{c.name}</span>
                                <span className="text-neutral-500"> — {c.company}</span>
                              </li>
                            ))}
                            <li className="border-t border-neutral-200"></li>
                          </>
                        ) : (
                          <li className="px-4 py-3 text-sm text-neutral-500 text-center border-b border-neutral-100">
                            No customers found matching &quot;{customerSearch}&quot;
                          </li>
                        )}
                        
                        {/* Always show Create New Customer at bottom */}
                        <li 
                          onClick={() => {
                            setNewCustomer({ name: "", company: customerSearch, email: "", phone: "", address: "" });
                            setShowNewCustomerForm(true);
                            setShowDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-red-50 cursor-pointer text-sm text-red-800 font-medium flex items-center gap-2 transition"
                        >
                          <UserPlus size={16} />
                          Create New Customer
                        </li>
                      </ul>
                    )}
                    
                    {/* Inline Quick Add Customer Form */}
                    {showNewCustomerForm && (
                      <div className="absolute z-30 w-full mt-1 bg-white border border-neutral-300 rounded-lg shadow-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-semibold text-black">Quick Add Customer</h4>
                          <button type="button" onClick={() => setShowNewCustomerForm(false)} className="text-neutral-400 hover:text-black">
                            <X size={16} />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Company *</label>
                              <input required value={newCustomer.company} onChange={e => setNewCustomer({...newCustomer, company: e.target.value})} className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-900" placeholder="Company Name" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Tax Identification Number (optional)</label>
                              <input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-900" placeholder="e.g. C1234567890" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Phone *</label>
                              <input required value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-900" placeholder="012-345 6789" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Email</label>
                              <input value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-900" placeholder="john@example.com" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Address</label>
                            <input value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-900" placeholder="Office Address" />
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateCustomer}
                            disabled={isCreatingCustomer || !newCustomer.company || !newCustomer.phone}
                            className="w-full py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-neutral-800 disabled:bg-neutral-300 transition"
                          >
                            {isCreatingCustomer ? "Saving..." : "Save & Select Customer"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <input type="hidden" {...register("customerId", { required: "Select a customer" })} />
                {errors.customerId && (
                  <p className="text-red-900/80 text-xs mt-1">{errors.customerId.message}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1.5">
                  Status
                </label>
                <select
                  {...register("status")}
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-black focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-900 transition"
                >
                  <option value="Draft">Draft</option>
                  <option value="Quoted">Quoted</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Paid</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
                  Line Items
                </h3>
                <button
                  type="button"
                  onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
                  className="flex items-center gap-1.5 text-sm text-red-800 hover:text-red-900 font-medium transition"
                >
                  <Plus size={14} />
                  Add Item
                </button>
              </div>

              <div className="hidden md:grid grid-cols-12 gap-3 px-1 mb-2 text-xs font-medium text-neutral-500 uppercase">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit Price (RM)</div>
                <div className="col-span-2 text-right">Row Total</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-2">
                {fields.map((field, index) => {
                  const qty = Number(watchedItems?.[index]?.quantity) || 0;
                  const price = Number(watchedItems?.[index]?.unitPrice) || 0;
                  const rowTotal = qty * price;

                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white border border-neutral-200 rounded-lg p-3 md:p-2"
                    >
                      <input
                        {...register(`items.${index}.description`, { required: true })}
                        placeholder="Item description"
                        required
                        className="col-span-1 md:col-span-5 w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white text-black text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-900 transition"
                      />
                      <input
                        {...register(`items.${index}.quantity`, { valueAsNumber: true, required: true })}
                        type="number"
                        min="1"
                        required
                        className="col-span-1 md:col-span-2 w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-red-900 transition"
                      />
                      <input
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true, required: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        className="col-span-1 md:col-span-2 w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-red-900 transition"
                      />
                      <div className="col-span-1 md:col-span-2 text-right text-sm font-semibold text-black">
                        {formatCurrency(rowTotal)}
                      </div>
                      <div className="col-span-1 md:col-span-1 flex justify-end">
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="p-1.5 text-neutral-400 hover:text-red-800 transition">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-neutral-200 pt-5">
              <div className="max-w-xs ml-auto space-y-2.5">
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-600">
                  <span>Discount (RM)</span>
                  <input
                    {...register("discount", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-black text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-900 transition"
                  />
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-600 border-b border-neutral-200 pb-2.5">
                  <span>Shipping Cost (RM)</span>
                  <input
                    {...register("shippingCost", { valueAsNumber: true, required: true })}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-28 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-black text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-900 transition"
                  />
                </div>
                <div className="pt-2.5">
                  <div className="flex justify-between text-lg font-bold text-black">
                    <span>Grand Total</span>
                    <span className="text-red-800">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-600 mt-2.5">
                  <span>Deposit (RM)</span>
                  <input
                    {...register("deposit", { valueAsNumber: true, required: true })}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-28 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-black text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-900 transition"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); reset(); setSelectedCustomerName(""); setShowNewCustomerForm(false); }}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-black transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !watchedCustomerId || totals.grandTotal <= 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-800 hover:bg-red-900 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-black">Order History</h2>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <FileText size={44} className="mx-auto mb-3 opacity-40" />
            <p>No orders yet. Create your first order above!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Customer</th>
                  <th className="px-6 py-3.5 font-medium">Items</th>
                  <th className="px-6 py-3.5 font-medium">Total</th>
                  <th className="px-6 py-3.5 font-medium">Status</th>
                  <th className="px-6 py-3.5 font-medium">Date</th>
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
                {orders.map((order) => (
                  <motion.tr 
                    variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } }}}
                    key={order.id} 
                    className="hover:bg-neutral-50/80 transition"
                  >
                    <td className="px-6 py-4 font-medium text-black">
                      {getCustomerName(order.customerId)}
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-6 py-4 font-semibold text-black">
                      {formatCurrency(order.grandTotal)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-neutral-100 text-neutral-600 border border-neutral-200"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {order.dateIssued ? formatDate(order.dateIssued) : "—"}
                    </td>
                    <td className="px-6 py-4 flex items-center justify-end gap-2 text-right">
                      {getCustomerById(order.customerId) && (
                        <DownloadButton
                          order={order}
                          customer={getCustomerById(order.customerId)!}
                        />
                      )}
                      
                      {order.status !== "Paid" && order.status !== "Cancelled" && (
                        <button
                          onClick={() => openPaymentModal(order)}
                          title={order.status === "Partially Paid" ? "Complete Payment" : "Mark as Paid"}
                          className="p-2 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 rounded-lg transition"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                      
                      <button
                        onClick={() => confirmDelete(order)}
                        title="Delete Order"
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

      {/* Payment Processing Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedOrder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-black">
                {selectedOrder.status === "Partially Paid" ? "Complete Payment" : "Process Payment"}
              </h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-neutral-400 hover:text-black transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleProcessPayment} className="p-6">
              <div className="mb-6 space-y-4">
                <div className="flex justify-between items-center px-4 py-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <span className="text-sm text-neutral-600 font-medium">Grand Total</span>
                  <span className="text-lg font-bold text-black">{formatCurrency(selectedOrder.grandTotal)}</span>
                </div>

                {selectedOrder.status === "Partially Paid" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-600">This order is partially paid. To complete the order, process the remaining balance.</p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-neutral-500">Deposit Paid:</span>
                      <span className="font-medium text-black">{formatCurrency(selectedOrder.deposit || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-neutral-200">
                      <span className="text-neutral-900 font-medium">Balance Due:</span>
                      <span className="text-red-800 font-bold">{formatCurrency(selectedOrder.grandTotal - (selectedOrder.deposit || 0))}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-700">Payment Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="paymentType" 
                            checked={paymentType === "Full"} 
                            onChange={() => setPaymentType("Full")}
                            className="text-red-800 focus:ring-red-900"
                          />
                          <span className="text-sm font-medium text-neutral-900">Full Payment</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="paymentType" 
                            checked={paymentType === "Partial"} 
                            onChange={() => setPaymentType("Partial")}
                            className="text-red-800 focus:ring-red-900"
                          />
                          <span className="text-sm font-medium text-neutral-900">Partial Payment (Deposit)</span>
                        </label>
                      </div>
                    </div>

                    {paymentType === "Partial" && (
                      <div className="space-y-2 pt-2">
                        <label className="block text-sm font-medium text-neutral-700">Deposit Amount (RM)</label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={selectedOrder.grandTotal - 0.01}
                          required
                          value={depositAmount || ""}
                          onChange={e => setDepositAmount(Number(e.target.value))}
                          placeholder="e.g. 1000.00"
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-900 text-black placeholder-neutral-400"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="flex items-center gap-2 px-6 py-2 bg-red-800 hover:bg-red-900 disabled:opacity-70 text-white text-sm font-medium rounded-lg transition"
                >
                  {isProcessingPayment ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Confirm Payment
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setOrderToDelete(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Order"
        description="Are you sure you want to delete this order? This action cannot be undone."
      />
    </div>
  );
}
