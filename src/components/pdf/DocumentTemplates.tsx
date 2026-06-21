/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Order, Customer, OrderItem } from "@/types";
import { generateDocReference } from "@/lib/utils";

// ============================================
// HELPERS
// ============================================

function fmtCurrency(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}


// ALL CAPS date format matching template: "14 MARCH 2026"
function fmtDateCaps(date: Date | { toDate?: () => Date } | undefined): string {
  if (!date) return "—";
  const d =
    typeof (date as unknown as { toDate?: () => Date }).toDate === "function"
      ? (date as unknown as { toDate: () => Date }).toDate()
      : (date as Date);
  return d
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

// Extract a sequence number from a Firestore ID for document numbering
function extractSequence(id: string): number {
  const digits = id.replace(/\D/g, "");
  const num = parseInt(digits.slice(-3) || "1", 10);
  return num || 1;
}

function addWorkingDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

function toJsDate(date: Date | { toDate?: () => Date } | undefined): Date {
  if (!date) return new Date();
  if (typeof (date as unknown as { toDate?: () => Date }).toDate === "function") {
    return (date as unknown as { toDate: () => Date }).toDate();
  }
  return date instanceof Date ? date : new Date();
}

// generateDocNumber removed — now using generateDocReference from @/lib/utils

// ============================================
// STYLES
// ============================================

const RED = "#D32F2F";
const BLACK = "#000000";
const GRAY_BG = "#F0F0F0";
const GRAY_TEXT = "#555555";
const BORDER = "#333333";
const LIGHT_BORDER = "#CCCCCC";


// ============================================
// SHARED COMPONENTS
// ============================================

interface DocProps {
  order: Order;
  customer: Customer;
}


// ============================================
// RECEIPT DOCUMENT (1 page)
// ============================================

const rs = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 30, paddingBottom: 220, paddingHorizontal: 30, color: BLACK, position: "relative" },
  watermarkContainer: { position: "absolute", top: 300, left: 100, width: 400, opacity: 0.1, zIndex: -1 },
  watermark: { width: "100%", height: "auto" },
  
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 25 },
  logoWrapper: { width: "40%" },
  logo: { width: 150, height: "auto" },
  headerRight: { width: "40%", alignItems: "flex-end", paddingTop: 10 },
  title: { fontSize: 34, fontFamily: "Helvetica-Bold", color: BLACK, letterSpacing: 1, marginBottom: 15 },
  docInfoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 6, width: "100%" },
  docInfoLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 1, width: 100 },
  docInfoValue: { fontSize: 10, textAlign: "right", width: 110 },

  addressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25 },
  fromCol: { width: "45%" },
  toCol: { width: "45%", alignItems: "flex-end" },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  addressTextSmall: { fontSize: 8.5, lineHeight: 1.6, color: BLACK },
  billToName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3, textAlign: "right" },
  billToText: { fontSize: 9, color: GRAY_TEXT, textAlign: "right", marginBottom: 2, textTransform: "uppercase" },

  table: { width: "100%", marginBottom: 15 },
  th: { flexDirection: "row", backgroundColor: RED, paddingVertical: 6, paddingHorizontal: 5 },
  thCellLeft: { color: "white", fontSize: 9, fontFamily: "Helvetica-Bold", width: "40%" },
  thCellCenter: { color: "white", fontSize: 9, fontFamily: "Helvetica-Bold", width: "15%", textAlign: "center" },
  thCellRight: { color: "white", fontSize: 9, fontFamily: "Helvetica-Bold", width: "15%", textAlign: "right" },
  tr: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 0 },
  tdCellLeft: { fontSize: 9, fontFamily: "Helvetica-Bold", width: "40%" },
  tdCellCenter: { fontSize: 9, fontFamily: "Helvetica-Bold", width: "15%", textAlign: "center" },
  tdCellRight: { fontSize: 9, fontFamily: "Helvetica-Bold", width: "15%", textAlign: "right" },
  
  footerContainer: { position: "absolute", bottom: 60, left: 30, right: 30 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  paymentBoxWrapper: { width: "48%", marginTop: 0 },
  paymentBox: { flexDirection: "row", borderWidth: 1, borderColor: BLACK },
  paymentRedPanel: { backgroundColor: RED, padding: 8, width: "32%", justifyContent: "center" },
  paymentRedText: { color: "white", fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 1.5 },
  paymentWhitePanel: { width: "68%" },
  paymentWhiteTop: { padding: 10, borderBottomWidth: 1, borderBottomColor: BLACK, minHeight: 40, justifyContent: "center" },
  paymentWhiteBottom: { padding: 10, minHeight: 35, justifyContent: "center" },
  paymentValueText: { fontSize: 9, color: BLACK },
  
  stampImageContainer: { alignItems: "center", marginTop: 20, position: "relative" },
  stampImage: { width: 140, opacity: 0.9, position: "absolute", bottom: -2, zIndex: -1 },

  signatureLine: { borderTopWidth: 1.5, borderTopColor: BLACK, paddingTop: 6, marginTop: 70 },
  signatureText: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  
  totalsWrapper: { width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", width: "60%", textAlign: "left" },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", width: "40%", textAlign: "right" },
  amountPaidBox: { backgroundColor: RED, paddingVertical: 10, paddingHorizontal: 10, flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  amountPaidLabel: { color: "white", fontSize: 12, fontFamily: "Helvetica-Bold" },
  amountPaidValue: { color: "white", fontSize: 12, fontFamily: "Helvetica-Bold" },
  
  legalNote: { fontSize: 7, color: GRAY_TEXT, lineHeight: 1.4, marginTop: 10, fontStyle: "italic" },
  
  footerText: { position: "absolute", bottom: 30, left: 0, right: 0, textAlign: "center", color: GRAY_TEXT, fontSize: 11 }
});

export function ReceiptDocument({ order, customer }: DocProps) {
  const seq = extractSequence(order.id);
  const docNumber = generateDocReference("OR", seq);
  const dateStr = fmtDateCaps(order.dateIssued);

  // Dynamic Payment Calculations
  const depositAmount = order.deposit || 0;
  const balanceAmount = order.grandTotal - depositAmount;
  // If partially paid, they only paid the deposit. If fully paid, they paid the grand total.
  const amountPaid = order.status === "Partially Paid" ? depositAmount : order.grandTotal;

  return (
    <Document>
      <Page size="A4" style={rs.page}>
        <View style={rs.watermarkContainer} fixed>
          <Image src="/logo.png" style={rs.watermark} />
        </View>
        
        {/* HEADER */}
        <View style={rs.headerRow}>
          <View style={rs.logoWrapper}>
            <Image src="/logo.png" style={rs.logo} />
          </View>
          <View style={rs.headerRight}>
            <Text style={rs.title}>RECEIPT</Text>
            <View style={rs.docInfoRow}>
              <Text style={rs.docInfoLabel}>RECEIPT NO. :</Text>
              <Text style={rs.docInfoValue}>{docNumber}</Text>
            </View>
            <View style={rs.docInfoRow}>
              <Text style={rs.docInfoLabel}>DATE :</Text>
              <Text style={rs.docInfoValue}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* FROM / BILL TO */}
        <View style={rs.addressRow}>
          <View style={rs.fromCol}>
            <Text style={rs.sectionTitle}>FROM</Text>
            <Text style={rs.companyName}>BizTask</Text>
            <Text style={rs.addressTextSmall}>202503066150 (003707379-A)</Text>
            <Text style={rs.addressTextSmall}>rzmegaresources@gmail.com</Text>
            <Text style={rs.addressTextSmall}>60182093758</Text>
            <Text style={rs.addressTextSmall}>1979, Kampung Sesapan Batu Minangkabau (VO)</Text>
            <Text style={rs.addressTextSmall}>43700 Beranang</Text>
            <Text style={rs.addressTextSmall}>Selangor Darul Ehsan</Text>
          </View>
          <View style={rs.toCol}>
            <Text style={rs.sectionTitle}>BILL TO</Text>
            <Text style={rs.billToName}>{customer.name || customer.company}</Text>
            <Text style={rs.billToText}>{customer.company}</Text>
            <Text style={rs.billToText}>{customer.phone}</Text>
          </View>
        </View>

        {/* TABLE */}
        <View style={rs.table}>
          <View style={rs.th}>
            <Text style={rs.thCellLeft}>DESCRIPTION</Text>
            <Text style={rs.thCellCenter}>PRICE/UNIT (RM)</Text>
            <Text style={rs.thCellCenter}>QUANTITY</Text>
            <Text style={rs.thCellCenter}>DISCOUNT</Text>
            <Text style={rs.thCellRight}>AMOUNT (RM)</Text>
          </View>
          {order.items.map((item, idx) => (
            <View key={idx} style={rs.tr}>
              <Text style={rs.tdCellLeft}>{item.description}</Text>
              <Text style={rs.tdCellCenter}>{item.unitPrice.toFixed(2)}</Text>
              <Text style={rs.tdCellCenter}>{item.quantity}</Text>
              <Text style={rs.tdCellCenter}>-</Text>
              <Text style={rs.tdCellRight}>{item.total.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* BOTTOM SECTION (FIXED AT BOTTOM) */}
        <View style={rs.footerContainer} fixed>
          <View style={rs.bottomRow}>
            {/* PAYMENT BOX + STAMP */}
            <View style={rs.paymentBoxWrapper}>
              <View style={rs.paymentBox}>
                <View style={rs.paymentRedPanel}>
                  <Text style={rs.paymentRedText}>PAYMENT</Text>
                  <Text style={rs.paymentRedText}>RECEIVED</Text>
                  <Text style={rs.paymentRedText}>FROM</Text>
                </View>
                <View style={rs.paymentWhitePanel}>
                  <View style={rs.paymentWhiteTop}>
                    <Text style={rs.paymentValueText}>{customer.name?.toUpperCase() || customer.company.toUpperCase()}</Text>
                  </View>
                  <View style={rs.paymentWhiteBottom}>
                    <Text style={rs.paymentValueText}>MAYBANK</Text>
                  </View>
                </View>
              </View>
              
              {/* STAMP UNDER PAYMENT BOX */}
              <View style={rs.stampImageContainer}>
                <Text style={{ fontSize: 8, color: GRAY_TEXT, opacity: 0.5, marginBottom: 5, zIndex: 10 }}>
                  AUTHORISED SIGNATURE
                </Text>
                <Image src="/stamp.png" style={rs.stampImage} />
                <View style={rs.signatureLine}>
                  <Text style={rs.signatureText}>AUTHORISED SIGNATURE / COMPANY STAMP</Text>
                </View>
              </View>
            </View>

            {/* TOTALS */}
            <View style={rs.totalsWrapper}>
              <View style={rs.totalRow}>
                <Text style={rs.totalLabel}>SUBTOTAL:</Text>
                <Text style={rs.totalValue}>{order.subtotal.toFixed(2)}</Text>
              </View>
              <View style={rs.totalRow}>
                <Text style={rs.totalLabel}>SHIPPING COST (RM) :</Text>
                <Text style={rs.totalValue}>0.00</Text>
              </View>
              <View style={rs.totalRow}>
                <Text style={rs.totalLabel}>DEPOSIT (RM) :</Text>
                <Text style={rs.totalValue}>{depositAmount.toFixed(2)}</Text>
              </View>
              <View style={rs.totalRow}>
                <Text style={rs.totalLabel}>
                  {order.status === "Partially Paid" ? "BALANCE DUE (RM) :" : "FINAL PAYMENT (RM) :"}
                </Text>
                <Text style={rs.totalValue}>{balanceAmount.toFixed(2)}</Text>
              </View>
              
              <View style={rs.amountPaidBox}>
                <Text style={rs.amountPaidLabel}>AMOUNT PAID :</Text>
                <Text style={rs.amountPaidValue}>RM {amountPaid.toFixed(2)}</Text>
              </View>
              
              <Text style={rs.legalNote}>
                This receipt is issued by BizTask under the Business Registration Act 1956 (Act 197). No SST is charged as this business is not registered under the Sales and Service Tax Act 2018 (Act 806).
              </Text>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <Text style={rs.footerText} fixed>Thank you for purchase!</Text>
      </Page>
    </Document>
  );
}

// ============================================
// QUOTATION DOCUMENT (2 pages)
// ============================================

const qs = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 11, paddingTop: 30, paddingBottom: 60, paddingHorizontal: 40, color: BLACK, position: "relative" },
  watermarkContainer: { position: "absolute", top: 350, left: 100, width: 400, opacity: 0.1, zIndex: -1 },
  watermark: { width: "100%", height: "auto" },
  
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 },
  logoWrapper: { width: "45%" },
  logo: { width: 180, height: "auto" },
  headerRight: { width: "45%", alignItems: "flex-end", paddingTop: 15 },
  title: { fontSize: 36, fontFamily: "Helvetica-Bold", color: BLACK, letterSpacing: 1.5, marginBottom: 15 },
  docInfoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 6, width: "100%" },
  docInfoLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 1, width: 105 },
  docInfoValue: { fontSize: 10, textAlign: "right", width: 115 },

  // From / Bill To
  addressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  fromCol: { width: "45%" },
  toCol: { width: "45%", alignItems: "flex-end" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, textTransform: "uppercase" },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  addressTextSmall: { fontSize: 9.5, lineHeight: 1.5, color: BLACK },
  addressTextBold: { fontSize: 9.5, fontFamily: "Helvetica-Bold", lineHeight: 1.5, color: BLACK },
  billToName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3, textAlign: "right" },
  billToText: { fontSize: 9.5, color: BLACK, textAlign: "right", marginBottom: 2, textTransform: "uppercase" },

  // Table
  table: { width: "100%", marginBottom: 20 },
  th: { flexDirection: "row", backgroundColor: RED, paddingVertical: 8, paddingHorizontal: 5 },
  thCellLeft: { color: "white", fontSize: 10, fontFamily: "Helvetica-Bold", width: "40%", textTransform: "uppercase" },
  thCellCenter: { color: "white", fontSize: 10, fontFamily: "Helvetica-Bold", width: "15%", textAlign: "center", textTransform: "uppercase" },
  thCellRight: { color: "white", fontSize: 10, fontFamily: "Helvetica-Bold", width: "15%", textAlign: "right", textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 0 },
  tdCellLeft: { fontSize: 10, fontFamily: "Helvetica-Bold", width: "40%", textTransform: "uppercase" },
  tdCellCenter: { fontSize: 10, width: "15%", textAlign: "center" },
  tdCellRight: { fontSize: 10, width: "15%", textAlign: "right" },

  // Bottom Section (Payment & Totals)
  bottomContainer: { position: "absolute", bottom: 65, left: 40, right: 40 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between" },
  
  // Payment Box
  paymentBoxWrapper: { width: "48%" },
  paymentBox: { flexDirection: "row", borderWidth: 1, borderColor: BLACK },
  paymentRedPanel: { backgroundColor: RED, padding: 8, width: "35%", justifyContent: "center" },
  paymentRedText: { color: "white", fontSize: 9.5, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 1.5 },
  paymentWhitePanel: { width: "65%" },
  paymentWhiteTop: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BLACK, minHeight: 30, justifyContent: "center" },
  paymentWhiteMiddle: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BLACK, minHeight: 30, justifyContent: "center" },
  paymentWhiteBottom: { paddingVertical: 8, paddingHorizontal: 10, minHeight: 30, justifyContent: "center" },
  paymentValueText: { fontSize: 9.5, color: BLACK },

  // Totals
  totalsWrapper: { width: "46%" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  totalLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold", width: "70%", textAlign: "left" },
  totalValue: { fontSize: 10.5, width: "30%", textAlign: "right" },
  totalValueBold: { fontSize: 10.5, fontFamily: "Helvetica-Bold", width: "30%", textAlign: "right" },
  amountPaidBox: { backgroundColor: RED, paddingVertical: 10, paddingHorizontal: 10, flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  amountPaidLabel: { color: "white", fontSize: 12, fontFamily: "Helvetica-Bold" },
  amountPaidValue: { color: "white", fontSize: 12, fontFamily: "Helvetica-Bold" },

  legalNote: { fontSize: 7, color: BLACK, fontStyle: "italic", lineHeight: 1.4, marginTop: 12 },

  pageNumber: { position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: GRAY_TEXT, fontSize: 11 },

  // --- PAGE 2 ---
  tcMainTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BLACK, marginBottom: 12, textTransform: "uppercase", textAlign: "center" },
  tcTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLACK, marginBottom: 4, textTransform: "uppercase" },
  tcSection: { marginBottom: 10 },
  tcBody: { fontSize: 9.5, lineHeight: 1.4, color: BLACK, textTransform: "uppercase", textAlign: "justify" },
  tcAcceptance: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BLACK, marginTop: 15, textTransform: "uppercase" },
  
  tcItalicBox: { marginTop: 15, width: 220 },
  tcItalicText: { fontSize: 8.5, color: BLACK, fontStyle: "italic", lineHeight: 1.4, textAlign: "justify" },

  scissorLineContainer: { flexDirection: "row", alignItems: "center", marginVertical: 18 },
  dashedLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: BLACK, borderStyle: "dashed" },
  scissorIconText: { fontSize: 16, paddingLeft: 5 }, // Unicode scissor

  confirmText: { fontSize: 9.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 25, lineHeight: 1.4 },

  sigBlock: { marginTop: 45 },
  sigDottedLine: { borderBottomWidth: 1, borderBottomColor: BLACK, borderStyle: "dotted", width: 125, marginBottom: 6 },
  sigLabelBold: { fontSize: 9.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  sigLabel: { fontSize: 9.5, textTransform: "uppercase", marginTop: 5 },
  
  stampAutoText: { fontSize: 7.5, color: BLACK, fontStyle: "italic", textAlign: "center", marginTop: 20 },
});

export function QuotationDocument({ order, customer }: DocProps) {
  const seq = extractSequence(order.id);
  const docNumber = generateDocReference("QT", seq);
  const issuedDate = toJsDate(order.dateIssued);

  return (
    <Document>
      {/* PAGE 1 */}
      <Page size="A4" style={qs.page}>
        <View style={qs.watermarkContainer} fixed>
          <Image src="/logo.png" style={qs.watermark} />
        </View>

        {/* HEADER */}
        <View style={qs.headerRow}>
          <View style={qs.logoWrapper}>
            <Image src="/logo.png" style={qs.logo} />
          </View>
          <View style={qs.headerRight}>
            <Text style={qs.title}>QUOTATION</Text>
            <View style={qs.docInfoRow}>
              <Text style={qs.docInfoLabel}>QUOTATION NO. :</Text>
              <Text style={qs.docInfoValue}>{docNumber}</Text>
            </View>
            <View style={qs.docInfoRow}>
              <Text style={qs.docInfoLabel}>DATE :</Text>
              <Text style={qs.docInfoValue}>{fmtDateCaps(issuedDate)}</Text>
            </View>
          </View>
        </View>

        {/* FROM / BILL TO */}
        <View style={qs.addressRow}>
          <View style={qs.fromCol}>
            <Text style={qs.sectionTitle}>FROM</Text>
            <Text style={qs.companyName}>BizTask</Text>
            <Text style={qs.addressTextBold}>202503066150 (003707379-A)</Text>
            <Text style={qs.addressTextBold}>rzmegaresources@gmail.com</Text>
            <Text style={qs.addressTextBold}>601127205895</Text>
            <Text style={qs.addressTextSmall}>1979, Kampung Sesapan Batu Minangkabau (VO)</Text>
            <Text style={qs.addressTextSmall}>43700 Beranang</Text>
            <Text style={qs.addressTextSmall}>Selangor Darul Ehsan</Text>
          </View>
          <View style={qs.toCol}>
            <Text style={qs.sectionTitle}>BILL TO</Text>
            <Text style={qs.billToName}>{customer.name || customer.company}</Text>
            <Text style={qs.billToText}>{customer.company}</Text>
            <Text style={qs.billToText}>{customer.address}</Text>
            <Text style={qs.billToText}>{customer.phone}</Text>
          </View>
        </View>

        {/* TABLE */}
        <View style={qs.table}>
          <View style={qs.th}>
            <Text style={qs.thCellLeft}>DESCRIPTION</Text>
            <Text style={qs.thCellCenter}>PRICE/UNIT (RM)</Text>
            <Text style={qs.thCellCenter}>QUANTITY</Text>
            <Text style={qs.thCellCenter}>DISCOUNT</Text>
            <Text style={qs.thCellRight}>AMOUNT (RM)</Text>
          </View>
          {order.items.map((item, idx) => (
            <View key={idx} style={qs.tr}>
              <Text style={qs.tdCellLeft}>{item.description}</Text>
              <Text style={qs.tdCellCenter}>{item.unitPrice.toFixed(2)}</Text>
              <Text style={qs.tdCellCenter}>{item.quantity}</Text>
              <Text style={qs.tdCellCenter}>-</Text>
              <Text style={qs.tdCellRight}>{item.total.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* BOTTOM SECTION */}
        <View style={qs.bottomContainer} fixed>
          <View style={qs.bottomRow}>
            {/* PAYMENT DETAILS */}
            <View style={qs.paymentBoxWrapper}>
              <View style={qs.paymentBox}>
                <View style={qs.paymentRedPanel}>
                  <Text style={qs.paymentRedText}>PAYMENT</Text>
                  <Text style={qs.paymentRedText}>DETAILS</Text>
                </View>
                <View style={qs.paymentWhitePanel}>
                  <View style={qs.paymentWhiteTop}>
                    <Text style={qs.paymentValueText}>BizTask</Text>
                  </View>
                  <View style={qs.paymentWhiteMiddle}>
                    <Text style={qs.paymentValueText}>HONG LEONG BANK</Text>
                  </View>
                  <View style={qs.paymentWhiteBottom}>
                    <Text style={qs.paymentValueText}>06900108226</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* TOTALS */}
            <View style={qs.totalsWrapper}>
              <View style={qs.totalRow}>
                <Text style={qs.totalLabel}>SUBTOTAL:</Text>
                <Text style={qs.totalValueBold}>{order.subtotal.toFixed(2)}</Text>
              </View>
              <View style={qs.totalRow}>
                <Text style={qs.totalLabel}>DISCOUNT (RM) :</Text>
                <Text style={qs.totalValueBold}>{(order.discount || 0).toFixed(2)}</Text>
              </View>
              <View style={qs.totalRow}>
                <Text style={qs.totalLabel}>SHIPPING COST (RM) :</Text>
                <Text style={qs.totalValueBold}>{(order.shippingCost || 0).toFixed(2)}</Text>
              </View>
              <View style={qs.totalRow}>
                <Text style={qs.totalLabel}>DEPOSIT (RM) :</Text>
                <Text style={qs.totalValueBold}>{(order.deposit || 0).toFixed(2)}</Text>
              </View>
              <View style={qs.totalRow}>
                <Text style={qs.totalLabel}>FINAL PAYMENT (RM) :</Text>
                <Text style={qs.totalValue}>{order.grandTotal.toFixed(2)}</Text>
              </View>
              
              <View style={qs.amountPaidBox}>
                <Text style={qs.amountPaidLabel}>TOTAL AMOUNT :</Text>
                <Text style={qs.amountPaidValue}>RM {order.grandTotal.toFixed(2)}</Text>
              </View>

              <Text style={qs.legalNote}>
                This quotation is issued by BizTask under the Business Registration Act 1956 (Act 197). No SST is charged as this business is not registered under the Sales and Service Tax Act 2018 (Act 806).
              </Text>
            </View>
          </View>
        </View>

        <Text style={qs.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} fixed />
      </Page>

      {/* PAGE 2 */}
      <Page size="A4" style={qs.page}>
        <View style={qs.watermarkContainer} fixed>
          <Image src="/logo.png" style={qs.watermark} />
        </View>

        {/* HEADER */}
        <View style={qs.headerRow}>
          <View style={qs.logoWrapper}>
            <Image src="/logo.png" style={qs.logo} />
          </View>
          <View style={qs.headerRight}>
            <Text style={qs.title}>QUOTATION</Text>
            <View style={qs.docInfoRow}>
              <Text style={qs.docInfoLabel}>QUOTATION NO. :</Text>
              <Text style={qs.docInfoValue}>{docNumber}</Text>
            </View>
            <View style={qs.tcItalicBox}>
              <Text style={qs.tcItalicText}>Kindly return a signed copy of the quotation below. This acceptance confirmation must be returned to us via email for further action. Any cancellation must be officially communicated to BizTask.</Text>
            </View>
          </View>
        </View>

        {/* TERMS & CONDITIONS */}
        <Text style={qs.tcMainTitle}>TERMS AND CONDITIONS</Text>
        
        <View style={qs.tcSection}>
          <Text style={qs.tcTitle}>1. QUOTATION VALIDITY</Text>
          <Text style={qs.tcBody}>THIS QUOTATION IS VALID FOR 10 WORKING DAYS FROM THE DATE OF ISSUE ({fmtDateCaps(issuedDate)}). BizTask RESERVES THE RIGHT TO REVISE THE PRICING OR TERMS AFTER THIS PERIOD HAS EXPIRED.</Text>
        </View>

        <View style={qs.tcSection}>
          <Text style={qs.tcTitle}>2. SCOPE OF WORK</Text>
          <Text style={qs.tcBody}>THE PRODUCTS OR SERVICES PROVIDED ARE STRICTLY LIMITED TO THE DESCRIPTIONS AND QUANTITIES LISTED IN THIS QUOTATION. ANY ADDITIONAL REQUESTS, MODIFICATIONS, OR ADD-ONS OUTSIDE THE ORIGINAL AGREED SCOPE WILL BE CONSIDERED EXTRA WORK AND WILL BE SUBJECT TO ADDITIONAL CHARGES.</Text>
        </View>

        <View style={qs.tcSection}>
          <Text style={qs.tcTitle}>3. DELIVERY</Text>
          <Text style={qs.tcBody}>THE ESTIMATED TIMELINE FOR DELIVERY OR COMPLETION WILL BE COMMUNICATED UPON RECEIPT OF THE DEPOSIT.</Text>
        </View>

        <View style={qs.tcSection}>
          <Text style={qs.tcTitle}>4. CANCELLATION POLICY</Text>
          <Text style={qs.tcBody}>IN THE EVENT OF CANCELLATION BY THE CLIENT AFTER THE DEPOSIT HAS BEEN PAID AND WORK/PROCESSING HAS COMMENCED, THE DEPOSIT IS STRICTLY NON-REFUNDABLE TO COVER THE COST OF LABOR, MATERIALS, AND RESOURCES ALREADY UTILIZED BY BizTask.</Text>
        </View>

        <Text style={qs.tcAcceptance}>ACCEPTANCE OF TERMS: BY PROCEEDING WITH THE DEPOSIT PAYMENT, THE CLIENT ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTOOD, AND AGREED TO THE TERMS AND CONDITIONS STATED ABOVE.</Text>

        {/* SCISSOR LINE REMOVED */}

        <Text style={qs.confirmText}>I/WE HEREBY CONFIRM THE ORDER AND ACCEPT THE QUOTATION OFFERED ABOVE, AND AGREE TO ALL THE TERMS AND CONDITIONS STATED.</Text>

        <View style={qs.sigBlock}>
          <View style={qs.sigDottedLine} />
          <Text style={qs.sigLabelBold}>(SIGNATURE)</Text>
          <Text style={qs.sigLabel}>NAME:</Text>
          <Text style={qs.sigLabel}>POSITION / COMPANY STAMP:</Text>
          <Text style={qs.sigLabel}>DATE:</Text>
        </View>

        <Text style={qs.stampAutoText}>(GENERATED AUTOMATICALLY. NO SIGNATURE FROM BizTask IS REQUIRED.)</Text>

        <Text style={qs.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
