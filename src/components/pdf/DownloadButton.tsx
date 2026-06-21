"use client";

import { useState } from "react";
import type { Order, Customer } from "@/types";
import { Eye, Loader2 } from "lucide-react";

interface DownloadButtonProps {
  order: Order;
  customer: Customer;
}

export default function DownloadButton({ order, customer }: DownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const isReceipt = order.status === "Paid" || order.status === "Partially Paid";
  const docType = isReceipt ? "Receipt" : "Quotation";

  const handleView = async () => {
    try {
      setIsGenerating(true);
      
      // Dynamically import react-pdf and templates only on click to bypass React 19/SSR bugs
      const { pdf } = await import("@react-pdf/renderer");
      const { ReceiptDocument, QuotationDocument } = await import("./DocumentTemplates");

      const DocComponent = isReceipt ? ReceiptDocument : QuotationDocument;

      // Generate the PDF as a blob
      const blob = await pdf(<DocComponent order={order} customer={customer} />).toBlob();
      
      // Create a temporary URL and open in a new tab for previewing
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      
      // Note: We don't immediately revoke the URL, as the new tab needs time to load the Blob
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("An error occurred while generating the document. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleView}
      disabled={isGenerating}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition ${
        isGenerating ? "bg-red-800 opacity-70 cursor-wait" : "bg-red-800 hover:bg-red-900 cursor-pointer"
      }`}
    >
      {isGenerating ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span>Generating...</span>
        </>
      ) : (
        <>
          <Eye size={14} />
          <span>{docType}</span>
        </>
      )}
    </button>
  );
}
