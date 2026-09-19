"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ShoppingBag,
  Truck,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Check,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Copy,
  X,
  Sliders,
} from "@/components/ui/FlatIcon";
import type { Issue } from "@/lib/types";

interface AsunPalaceContextPanelProps {
  issue?: Issue;
  onInsertReply?: (text: string) => void;
  onNotify?: (msg: string, type?: "success" | "error" | "info") => void;
}

interface StoreOrder {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "refunded" | "cancelled";
  fulfillmentMethod: string;
  driverName?: string;
  driverEta?: string;
  deliveryNotes?: string;
  items: Array<{ name: string; qty: number; price: number; options?: string }>;
  total: number;
  placedAt: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: "Entrees" | "Sides & Rice" | "Small Chops" | "Beverages";
  price: number;
  stockStatus: "in_stock" | "low_stock" | "sold_out";
  stockCount: number;
  allergens: string[];
  dietary: string[];
  description: string;
}

const MOCK_ASUN_ORDERS: StoreOrder[] = [
  {
    orderId: "ORD-94021",
    customerName: "Marcus Vance",
    customerEmail: "marcus@meridiancorp.com",
    customerPhone: "+1 (555) 839-2041",
    status: "out_for_delivery",
    fulfillmentMethod: "Local Driver (Route 402)",
    driverName: "Alex R.",
    driverEta: "12 mins",
    deliveryNotes: "Apt 4B - please buzz #4412 and leave at door.",
    items: [
      { name: "Signature Asun Peppered Goat Meat", qty: 2, price: 18.5, options: "Medium Heat" },
      { name: "Smoky Party Jollof Rice Feast", qty: 1, price: 16.0, options: "Extra Fried Plantains" },
      { name: "Chapman Nigerian Mocktail", qty: 2, price: 6.0 },
    ],
    total: 65.0,
    placedAt: "Today, 4:25 PM",
  },
  {
    orderId: "ORD-93884",
    customerName: "Elena Rostova",
    customerEmail: "elena@enterprise.com",
    customerPhone: "+1 (555) 774-9022",
    status: "delivered",
    fulfillmentMethod: "Local Driver",
    driverName: "Kofi B.",
    items: [
      { name: "Egusi Soup with Pounded Yam", qty: 1, price: 19.5, options: "Assorted Meat (Goat & Beef)" },
      { name: "Suya Beef Skewers (4 pcs)", qty: 2, price: 14.0, options: "Spicy Yaji Pepper" },
    ],
    total: 47.5,
    placedAt: "Yesterday, 7:10 PM",
  },
  {
    orderId: "ORD-93710",
    customerName: "Valued Shopper",
    customerEmail: "shopper@example.com",
    customerPhone: "+1 (555) 431-8890",
    status: "preparing",
    fulfillmentMethod: "Store Pickup",
    deliveryNotes: "Pickup in 25 mins",
    items: [
      { name: "Signature Asun Peppered Goat Meat", qty: 1, price: 18.5, options: "Extra Spicy" },
      { name: "Fried Sweet Plantains (Dodo)", qty: 2, price: 6.5 },
    ],
    total: 31.5,
    placedAt: "Today, 5:10 PM",
  },
];

const ASUN_MENU_CATALOG: MenuItem[] = [
  {
    id: "menu_asun_goat",
    name: "Signature Asun (Peppered Goat Meat)",
    category: "Entrees",
    price: 18.5,
    stockStatus: "in_stock",
    stockCount: 24,
    allergens: ["None"],
    dietary: ["Halal", "Dairy-Free", "Gluten-Free"],
    description: "Slow-roasted tender bite-sized goat meat sauteed in hot habanero peppers, aromatic onions, and savory spices.",
  },
  {
    id: "menu_jollof_feast",
    name: "Smoky Party Jollof Rice Feast",
    category: "Sides & Rice",
    price: 16.0,
    stockStatus: "in_stock",
    stockCount: 38,
    allergens: ["None"],
    dietary: ["Halal", "Vegetarian Option Available"],
    description: "Authentic wood-fire infused long grain rice simmered with rich tomato plum reduction, bell peppers, thyme, and bay leaves.",
  },
  {
    id: "menu_suya_beef",
    name: "Suya Beef Skewers (Spicy)",
    category: "Small Chops",
    price: 14.0,
    stockStatus: "in_stock",
    stockCount: 16,
    allergens: ["Peanuts (Groundnut Kulikuli Powder)"],
    dietary: ["Halal"],
    description: "Thinly sliced prime beef coated with authentic roasted peanut powder, ginger, garlic, and hot Northern spices.",
  },
  {
    id: "menu_egusi_soup",
    name: "Egusi Soup with Pounded Yam",
    category: "Entrees",
    price: 19.5,
    stockStatus: "low_stock",
    stockCount: 3,
    allergens: ["Fish (Ground Crayfish)"],
    dietary: ["Halal"],
    description: "Hearty ground melon seed stew cooked with fresh spinach, bitterleaf, smoked fish, and served with silky smooth pounded yam.",
  },
  {
    id: "menu_chapman",
    name: "Chapman Nigerian Mocktail",
    category: "Beverages",
    price: 6.0,
    stockStatus: "in_stock",
    stockCount: 45,
    allergens: ["None"],
    dietary: ["Vegetarian", "Non-Alcoholic"],
    description: "Refreshing blend of citrus soda, aromatic bitters, pomegranate grenadine, fresh cucumber slices, and lemon twist.",
  },
];

export function AsunPalaceContextPanel({
  issue,
  onInsertReply,
  onNotify,
}: AsunPalaceContextPanelProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "policy">("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("ORD-94021");
  const [isRefunding, setIsRefunding] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Auto-match order from issue metadata or intake data
  const candidateSearch = useMemo(() => {
    if (!issue) return "";
    const fromRef = issue.customerRef?.match(/ORD-\d+/i)?.[0];
    const fromSummary = issue.summary?.match(/ORD-\d+/i)?.[0];
    const fromExternal = issue.externalId?.match(/ORD-\d+/i)?.[0];
    return fromRef || fromSummary || fromExternal || issue.customerName || "";
  }, [issue]);

  // Selected Order
  const activeOrder = useMemo(() => {
    if (selectedOrderId) {
      const match = MOCK_ASUN_ORDERS.find((o) => o.orderId.toLowerCase() === selectedOrderId.toLowerCase());
      if (match) return match;
    }
    if (candidateSearch) {
      const match = MOCK_ASUN_ORDERS.find(
        (o) =>
          o.orderId.toLowerCase() === candidateSearch.toLowerCase() ||
          o.customerName.toLowerCase().includes(candidateSearch.toLowerCase()) ||
          o.customerEmail.toLowerCase().includes(candidateSearch.toLowerCase())
      );
      if (match) return match;
    }
    return MOCK_ASUN_ORDERS[0];
  }, [selectedOrderId, candidateSearch]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    let list = ASUN_MENU_CATALOG;
    if (selectedCategory !== "All") {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.allergens.some((a) => a.toLowerCase().includes(q))
    );
  }, [searchQuery, selectedCategory]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
    onNotify?.(`Copied ${label} to clipboard`, "info");
  };

  const handleInsertOrderStatus = () => {
    if (!activeOrder) return;
    const itemsList = activeOrder.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
    const text = `Hi ${activeOrder.customerName}! I checked our OrderV8 system for your order ${activeOrder.orderId} (${itemsList} - $${activeOrder.total.toFixed(2)}). The status is currently ${activeOrder.status.replace(/_/g, " ").toUpperCase()}${activeOrder.driverName ? ` with driver ${activeOrder.driverName} (ETA ~${activeOrder.driverEta || "15 mins"})` : ""}. Let me know if you need any further assistance!`;
    onInsertReply?.(text);
    onNotify?.("Inserted live order status into reply composer", "success");
    setIsDrawerOpen(false);
  };

  const handleInsertMenuItem = (item: MenuItem) => {
    const text = `Regarding ${item.name} ($${item.price.toFixed(2)}): ${item.description} It is currently ${item.stockStatus.replace(/_/g, " ")}. Dietary tags: ${item.dietary.join(", ")}. Allergens: ${item.allergens.join(", ")}.`;
    onInsertReply?.(text);
    onNotify?.(`Inserted details for ${item.name} into reply composer`, "success");
    setIsDrawerOpen(false);
  };

  const handleConfirmRefund = () => {
    if (!activeOrder) return;
    setIsRefunding(true);
    setTimeout(() => {
      setIsRefunding(false);
      setShowRefundConfirm(false);
      activeOrder.status = "refunded";
      onNotify?.(`Refund of $${activeOrder.total.toFixed(2)} processed for ${activeOrder.orderId} via OrderV8`, "success");
      onInsertReply?.(
        `We have successfully processed a full refund of $${activeOrder.total.toFixed(2)} for your order ${activeOrder.orderId}. The credit will reflect on your original payment method in 1-3 business days.`
      );
      setIsDrawerOpen(false);
    }, 900);
  };

  const statusColor = (status: StoreOrder["status"]) => {
    switch (status) {
      case "out_for_delivery":
        return "bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/50";
      case "delivered":
        return "bg-[#4CC38A]/20 text-[#4CC38A] border-[#4CC38A]/50";
      case "preparing":
        return "bg-[#4D9FFF]/20 text-[#4D9FFF] border-[#4D9FFF]/50";
      case "refunded":
        return "bg-[#FF5C5C]/20 text-[#FF5C5C] border-[#FF5C5C]/50";
      default:
        return "bg-[#6B7C8D]/20 text-[#B4C2D0] border-[#6B7C8D]/50";
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. SLEEK COMPACT LAUNCHER CARD (Rendered in Ticket Pane) */}
      {/* ========================================================================= */}
      <div className="p-3 bg-[#111822] border border-[#F5A623]/30 hover:border-[#F5A623]/60 rounded-2xl transition-all shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-[#F5A623]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-[#EAF1F8] font-mono">Asun Palace Store</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                  OrderV8
                </span>
              </div>
              <p className="text-[10px] text-[#8E9AA8] font-mono truncate">
                {activeOrder
                  ? `${activeOrder.orderId} • ${activeOrder.status.replace(/_/g, " ").toUpperCase()}`
                  : "Live Orders, Menu & Store Context"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[#F5A623] hover:bg-[#FFBF53] text-[#04201C] font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-[#F5A623]/25 cursor-pointer shrink-0 active:scale-95"
            title="Open dedicated Asun Palace Store Hub (Orders, Menu & Allergen Catalog)"
          >
            <span>Open Store Hub</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SOPHISTICATED SLIDE-OVER CONTEXT DRAWER */}
      {/* ========================================================================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
          {/* Backdrop Blur */}
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-[#0B1017] border-l border-[#F5A623]/30 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250">
              
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-[var(--line)] bg-[#0E1520] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/40 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-[#F5A623]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-[#EAF1F8] font-mono">
                        Asun Palace Store Operations Hub
                      </h3>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                        OrderV8 Synchronized
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8E9AA8] font-mono">
                      Dedicated commerce cockpit: Order 360, live menu & allergens, store policies
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://apalace.order.servicev8.com/apalace/admin/orders${activeOrder ? `?search=${activeOrder.orderId}` : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-[#141C26] hover:bg-[#1C2736] border border-[var(--line-2)] text-xs font-mono text-[#F5A623] hover:text-[#FFBF53] flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Open OrderV8 Admin portal in a new tab"
                  >
                    <span>Store Admin</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 rounded-xl bg-[#141C26] hover:bg-[#1C2736] text-[#8E9AA8] hover:text-[#EAF1F8] border border-[var(--line)] transition-colors cursor-pointer"
                    title="Close Drawer (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Segmented Top Navigation */}
              <div className="p-3 bg-[#080C12] border-b border-[var(--line)] shrink-0">
                <div className="grid grid-cols-3 gap-1 bg-[#101722] p-1 rounded-xl border border-[var(--line)] font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      activeTab === "orders"
                        ? "bg-[#F5A623] text-[#04201C] shadow-sm shadow-[#F5A623]/30"
                        : "text-[#8E9AA8] hover:text-[#EAF1F8]"
                    }`}
                  >
                    Order 360 & Triage
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("menu")}
                    className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      activeTab === "menu"
                        ? "bg-[#F5A623] text-[#04201C] shadow-sm shadow-[#F5A623]/30"
                        : "text-[#8E9AA8] hover:text-[#EAF1F8]"
                    }`}
                  >
                    Menu & Allergen Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("policy")}
                    className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      activeTab === "policy"
                        ? "bg-[#F5A623] text-[#04201C] shadow-sm shadow-[#F5A623]/30"
                        : "text-[#8E9AA8] hover:text-[#EAF1F8]"
                    }`}
                  >
                    Store Policies & Hours
                  </button>
                </div>
              </div>

              {/* Drawer Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                
                {/* ------------------------------------------------------------- */}
                {/* TAB 1: ORDER 360 */}
                {/* ------------------------------------------------------------- */}
                {activeTab === "orders" && (
                  <div className="space-y-4 font-mono">
                    {/* Order Selector Chips */}
                    <div>
                      <span className="text-[10.5px] uppercase text-[#6B7C8D] block font-bold mb-1.5">
                        Matched Store Orders:
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {MOCK_ASUN_ORDERS.map((o) => {
                          const isSelected = activeOrder?.orderId === o.orderId;
                          return (
                            <button
                              key={o.orderId}
                              type="button"
                              onClick={() => setSelectedOrderId(o.orderId)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-mono shrink-0 transition-all border cursor-pointer ${
                                isSelected
                                  ? "bg-[#1C2634] text-[#F5A623] border-[#F5A623] font-bold shadow-md shadow-[#F5A623]/20"
                                  : "bg-[#0E1520] text-[#8E9AA8] border-[var(--line)] hover:text-[#EAF1F8]"
                              }`}
                            >
                              {o.orderId} • {o.customerName}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {activeOrder ? (
                      <div className="p-4 rounded-2xl bg-[#0D131C] border border-[var(--line)] space-y-4">
                        {/* Order Header */}
                        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-[#EAF1F8]">{activeOrder.orderId}</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusColor(activeOrder.status)}`}>
                                {activeOrder.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <span className="text-xs text-[#8E9AA8]">Placed: {activeOrder.placedAt}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-[#8E9AA8] block">Total Charged</span>
                            <span className="text-lg font-bold text-[#2ED8B6]">${activeOrder.total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Customer & Delivery Coordinates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#111722] p-3.5 rounded-xl border border-[var(--line)] text-xs">
                          <div>
                            <span className="text-[10px] uppercase text-[#6B7C8D] block font-bold">Customer Details</span>
                            <p className="font-bold text-[#EAF1F8] mt-0.5">{activeOrder.customerName}</p>
                            <p className="text-[#8E9AA8]">{activeOrder.customerEmail}</p>
                            <button
                              type="button"
                              onClick={() => handleCopy(activeOrder.customerPhone, "phone")}
                              className="text-[#2ED8B6] hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                            >
                              <span>{activeOrder.customerPhone}</span>
                              {copiedField === "phone" ? <Check className="w-3 h-3 text-[#2ED8B6]" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#6B7C8D] block font-bold">Fulfillment & Route</span>
                            <p className="font-bold text-[#EAF1F8] mt-0.5">{activeOrder.fulfillmentMethod}</p>
                            {activeOrder.driverEta && (
                              <p className="text-[#F5A623] font-bold flex items-center gap-1 mt-1">
                                <Truck className="w-3.5 h-3.5" /> Driver: {activeOrder.driverName} (ETA: {activeOrder.driverEta})
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Delivery Notes */}
                        {activeOrder.deliveryNotes && (
                          <div className="bg-[#151D28] p-3 rounded-xl border border-[var(--line)] text-xs">
                            <span className="text-[10px] uppercase text-[#F5A623] block font-bold">Special Delivery Instructions:</span>
                            <p className="text-[#EAF1F8] mt-0.5 italic">"{activeOrder.deliveryNotes}"</p>
                          </div>
                        )}

                        {/* Items Table */}
                        <div className="space-y-1.5 bg-[#111722] p-3.5 rounded-xl border border-[var(--line)]">
                          <span className="text-[10px] uppercase text-[#6B7C8D] block font-bold">Dish Items & Options:</span>
                          <div className="divide-y divide-[var(--line)]">
                            {activeOrder.items.map((item, idx) => (
                              <div key={idx} className="py-2 flex justify-between items-center text-xs">
                                <div>
                                  <span className="text-[#EAF1F8] font-bold">{item.qty}×</span>{" "}
                                  <span className="text-[#B4C2D0]">{item.name}</span>
                                  {item.options && (
                                    <span className="text-[#8E9AA8] text-[10.5px] block">Option: {item.options}</span>
                                  )}
                                </div>
                                <span className="font-bold text-[#EAF1F8]">${(item.price * item.qty).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Guarded Refund Modal */}
                        {showRefundConfirm && (
                          <div className="p-3.5 rounded-xl bg-[#FF5C5C]/10 border border-[#FF5C5C]/40 space-y-2 animate-in fade-in">
                            <div className="flex items-center gap-2 text-[#FF8585]">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span className="font-bold text-xs">Confirm Financial Refund</span>
                            </div>
                            <p className="text-xs text-[#B4C2D0]">
                              Are you sure you want to issue a full refund of <strong className="text-white">${activeOrder.total.toFixed(2)}</strong> for order <strong>{activeOrder.orderId}</strong> to <strong>{activeOrder.customerName}</strong>?
                            </p>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setShowRefundConfirm(false)}
                                className="px-3 py-1.5 rounded-lg bg-[#141C26] hover:bg-[#1E2B3A] text-xs text-[#B4C2D0] border border-[var(--line)] cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleConfirmRefund}
                                disabled={isRefunding}
                                className="px-3 py-1.5 rounded-lg bg-[#FF5C5C] hover:bg-[#FF7373] text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                              >
                                {isRefunding ? "Processing Refund..." : "Confirm & Issue Refund"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Quick Operator Actions */}
                        <div className="pt-2 border-t border-[var(--line)] flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleInsertOrderStatus}
                            className="px-3.5 py-2 rounded-xl bg-[#2ED8B6] hover:bg-[#57E5C8] text-[#04201C] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20 transition-all active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Insert Status in Chat & Close</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowRefundConfirm(true)}
                            disabled={activeOrder.status === "refunded"}
                            className="px-3.5 py-2 rounded-xl bg-[#FF5C5C]/15 hover:bg-[#FF5C5C]/25 text-[#FF8585] border border-[#FF5C5C]/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{activeOrder.status === "refunded" ? "Order Refunded" : `Refund $${activeOrder.total.toFixed(2)}`}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onNotify?.(`Resent SMS tracking link to ${activeOrder.customerPhone}`, "success");
                              onInsertReply?.(
                                `We have resent your live delivery tracking link via SMS to ${activeOrder.customerPhone}. You can follow your driver's real-time route directly from your phone.`
                              );
                              setIsDrawerOpen(false);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-[#141C26] hover:bg-[#1E2B3A] text-[#B4C2D0] border border-[var(--line)] text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Resend Tracking Link SMS</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-xs text-[#8E9AA8]">No order found matching criteria.</div>
                    )}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* TAB 2: MENU & ALLERGEN CATALOG */}
                {/* ------------------------------------------------------------- */}
                {activeTab === "menu" && (
                  <div className="space-y-4 font-mono">
                    {/* Search & Category Filters */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-[#6B7C8D]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search dishes, ingredients, allergens (e.g. Asun, peanut, habanero)..."
                          className="w-full pl-9 pr-4 py-2.5 bg-[#080C12] border border-[var(--line)] rounded-xl text-xs font-mono text-[#EAF1F8] placeholder-[#6B7C8D] focus:outline-none focus:border-[#F5A623]"
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {["All", "Entrees", "Sides & Rice", "Small Chops", "Beverages"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] transition-all cursor-pointer ${
                              selectedCategory === cat
                                ? "bg-[#F5A623] text-[#04201C] font-bold"
                                : "bg-[#111722] text-[#8E9AA8] hover:text-[#EAF1F8] border border-[var(--line)]"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dish Cards */}
                    <div className="space-y-2.5">
                      {filteredMenuItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-[#0D131C] border border-[var(--line)] hover:border-[#F5A623]/40 transition-colors space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-[#EAF1F8] text-sm">{item.name}</span>
                              <span className="text-xs text-[#F5A623] font-bold ml-2">${item.price.toFixed(2)}</span>
                            </div>
                            <span
                              className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                item.stockStatus === "in_stock"
                                  ? "bg-[#4CC38A]/15 text-[#4CC38A] border border-[#4CC38A]/30"
                                  : item.stockStatus === "low_stock"
                                  ? "bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30"
                                  : "bg-[#FF5C5C]/15 text-[#FF5C5C] border border-[#FF5C5C]/30"
                              }`}
                            >
                              {item.stockStatus.replace(/_/g, " ")} ({item.stockCount})
                            </span>
                          </div>

                          <p className="text-[11.5px] text-[#B4C2D0] leading-relaxed">{item.description}</p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
                            <div className="flex flex-wrap gap-1.5">
                              {item.dietary.map((d, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-[#16212E] text-[#2ED8B6] text-[10px]">
                                  {d}
                                </span>
                              ))}
                              {item.allergens.map((a, i) => (
                                <span
                                  key={i}
                                  className={`px-2 py-0.5 rounded-md text-[10px] ${
                                    a === "None"
                                      ? "bg-[#16212E] text-[#8E9AA8]"
                                      : "bg-[#FF5C5C]/15 text-[#FF8585] font-bold border border-[#FF5C5C]/30"
                                  }`}
                                >
                                  {a === "None" ? "No Allergens" : `⚠️ Allergen: ${a}`}
                                </span>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleInsertMenuItem(item)}
                              className="px-2.5 py-1 rounded-lg bg-[#F5A623]/20 hover:bg-[#F5A623]/30 text-[#F5A623] hover:text-[#FFBF53] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>Insert in Reply &rarr;</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* TAB 3: STORE POLICIES */}
                {/* ------------------------------------------------------------- */}
                {activeTab === "policy" && (
                  <div className="space-y-3.5 font-mono text-xs bg-[#0D131C] p-4 rounded-2xl border border-[var(--line)]">
                    <div className="space-y-1">
                      <span className="text-[10.5px] uppercase text-[#F5A623] font-bold">Kitchen & Operating Hours:</span>
                      <p className="text-[#EAF1F8] font-bold">Monday – Sunday: 11:00 AM – 10:30 PM EST</p>
                      <p className="text-[11px] text-[#8E9AA8]">
                        Late night delivery runs until 11:30 PM on Fridays and Saturdays. Orders placed 15 minutes before close are dispatched immediately.
                      </p>
                    </div>

                    <div className="space-y-1 pt-2.5 border-t border-[var(--line)]">
                      <span className="text-[10.5px] uppercase text-[#F5A623] font-bold">Delivery Radius & Charges:</span>
                      <p className="text-[#EAF1F8]">Standard local fleet delivery radius: <strong>8.5 miles</strong>.</p>
                      <p className="text-[11px] text-[#8E9AA8]">Orders over $50 qualify for complimentary delivery. Express hot-bag thermal dispatch guaranteed.</p>
                    </div>

                    <div className="space-y-1 pt-2.5 border-t border-[var(--line)]">
                      <span className="text-[10.5px] uppercase text-[#F5A623] font-bold">Food Quality Guarantee & Instant Replacement:</span>
                      <p className="text-[11px] text-[#B4C2D0]">
                        If an order arrives cold, missing items, or tampered with, operators have full authorization to issue an instant full refund or re-dispatch with high-priority kitchen status within 2 hours of delivery.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[var(--line)] flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onInsertReply?.(
                            "Asun Palace Store Hours: Mon–Sun 11:00 AM – 10:30 PM EST. We deliver within an 8.5-mile radius. We guarantee 100% fresh delivery — if you have any issue with your order, we can replace it immediately or issue a full refund."
                          );
                          onNotify?.("Inserted store policies into reply composer", "info");
                          setIsDrawerOpen(false);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#F5A623] hover:bg-[#FFBF53] text-[#04201C] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#F5A623]/25 transition-all active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Insert Store Policy in Reply & Close</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
