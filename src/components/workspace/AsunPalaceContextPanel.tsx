"use client";

import React, { useState, useMemo } from "react";
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
  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "policy">("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("ORD-94021");
  const [isRefunding, setIsRefunding] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
    if (!searchQuery.trim()) return ASUN_MENU_CATALOG;
    const q = searchQuery.toLowerCase();
    return ASUN_MENU_CATALOG.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.allergens.some((a) => a.toLowerCase().includes(q))
    );
  }, [searchQuery]);

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
  };

  const handleInsertMenuItem = (item: MenuItem) => {
    const text = `Regarding ${item.name} ($${item.price.toFixed(2)}): ${item.description} It is currently ${item.stockStatus.replace(/_/g, " ")}. Dietary tags: ${item.dietary.join(", ")}. Allergens: ${item.allergens.join(", ")}.`;
    onInsertReply?.(text);
    onNotify?.(`Inserted details for ${item.name} into reply composer`, "success");
  };

  const handleProcessRefund = () => {
    if (!activeOrder) return;
    setIsRefunding(true);
    setTimeout(() => {
      setIsRefunding(false);
      activeOrder.status = "refunded";
      onNotify?.(`Refund of $${activeOrder.total.toFixed(2)} processed for ${activeOrder.orderId} via OrderV8`, "success");
      onInsertReply?.(
        `We have successfully processed a full refund of $${activeOrder.total.toFixed(2)} for your order ${activeOrder.orderId}. The credit will reflect on your original payment method in 1-3 business days.`
      );
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
    <div className="card p-3.5 sm:p-4 bg-[#101722] border border-[#F5A623]/30 rounded-2xl space-y-3.5 shadow-lg shadow-black/30">
      {/* Header with Branding & Direct Link */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#F5A623]/20 flex items-center justify-center border border-[#F5A623]/40">
            <ShoppingBag className="w-3.5 h-3.5 text-[#F5A623]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-[#EAF1F8] font-mono">Asun Palace Store</h4>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                OrderV8 Live
              </span>
            </div>
            <p className="text-[10px] text-[#8E9AA8] font-mono">In-Cockpit Commerce & Catalog Context</p>
          </div>
        </div>

        {/* Instant SSO Deep-Link Button */}
        <a
          href={`https://apalace.order.servicev8.com/apalace/admin/orders${activeOrder ? `?search=${activeOrder.orderId}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 py-1 rounded-lg bg-[#141C26] hover:bg-[#1C2736] border border-[var(--line-2)] text-[10px] font-mono text-[#F5A623] hover:text-[#FFBF53] flex items-center gap-1 transition-all cursor-pointer"
          title="Open complete administrative controls in OrderV8 portal"
        >
          <span>Store Admin</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="grid grid-cols-3 gap-1 bg-[#090D14] p-1 rounded-xl border border-[var(--line)] text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`py-1 rounded-lg font-bold text-[10.5px] transition-all cursor-pointer ${
            activeTab === "orders" ? "bg-[#F5A623] text-[#04201C] shadow-sm shadow-[#F5A623]/30" : "text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          Order 360
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("menu")}
          className={`py-1 rounded-lg font-bold text-[10.5px] transition-all cursor-pointer ${
            activeTab === "menu" ? "bg-[#F5A623] text-[#04201C] shadow-sm shadow-[#F5A623]/30" : "text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          Menu & Catalog
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("policy")}
          className={`py-1 rounded-lg font-bold text-[10.5px] transition-all cursor-pointer ${
            activeTab === "policy" ? "bg-[#F5A623] text-[#04201C] shadow-sm shadow-[#F5A623]/30" : "text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          Store Policies
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ORDER 360 */}
      {/* ========================================================================= */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {/* Order Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MOCK_ASUN_ORDERS.map((o) => {
              const isSelected = activeOrder?.orderId === o.orderId;
              return (
                <button
                  key={o.orderId}
                  type="button"
                  onClick={() => setSelectedOrderId(o.orderId)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono shrink-0 transition-all border cursor-pointer ${
                    isSelected
                      ? "bg-[#182332] text-[#F5A623] border-[#F5A623]/60 font-bold"
                      : "bg-[#0E1520] text-[#8E9AA8] border-[var(--line)] hover:text-[#EAF1F8]"
                  }`}
                >
                  {o.orderId} ({o.customerName.split(" ")[0]})
                </button>
              );
            })}
          </div>

          {activeOrder ? (
            <div className="p-3 rounded-xl bg-[#0D131C] border border-[var(--line)] space-y-2.5 font-mono text-xs">
              {/* Order Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-[#EAF1F8]">{activeOrder.orderId}</span>
                  <span className="text-[10px] text-[#8E9AA8] ml-2">{activeOrder.placedAt}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${statusColor(activeOrder.status)}`}>
                  {activeOrder.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Items Summary */}
              <div className="space-y-1 bg-[#131A24] p-2.5 rounded-lg border border-[var(--line)]">
                <div className="text-[10px] uppercase text-[#6B7C8D] font-semibold">Ordered Items:</div>
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] text-[#B4C2D0]">
                    <span>
                      <strong className="text-[#EAF1F8]">{item.qty}×</strong> {item.name}
                      {item.options && <span className="text-[#8E9AA8] text-[9.5px]"> ({item.options})</span>}
                    </span>
                    <span className="text-[#EAF1F8] font-mono">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-[var(--line)] pt-1 mt-1 flex justify-between items-center font-bold text-xs text-[#2ED8B6]">
                  <span>Total (inc. tax & delivery)</span>
                  <span>${activeOrder.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Delivery & Customer Info */}
              <div className="space-y-1 text-[10.5px] text-[#8E9AA8]">
                <div className="flex items-center justify-between">
                  <span>Customer: <strong className="text-[#EAF1F8]">{activeOrder.customerName}</strong></span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeOrder.customerPhone, "phone")}
                    className="hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer"
                  >
                    <span>{activeOrder.customerPhone}</span>
                    {copiedField === "phone" ? <Check className="w-3 h-3 text-[#2ED8B6]" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fulfillment: <strong className="text-[#EAF1F8]">{activeOrder.fulfillmentMethod}</strong></span>
                  {activeOrder.driverEta && (
                    <span className="text-[#F5A623] font-bold flex items-center gap-1">
                      <Truck className="w-3 h-3" /> ETA: {activeOrder.driverEta}
                    </span>
                  )}
                </div>
                {activeOrder.deliveryNotes && (
                  <div className="bg-[#182332] p-2 rounded text-[#B4C2D0] border border-[var(--line)] mt-1">
                    <span className="text-[9px] uppercase text-[#F5A623] block font-bold">Delivery Instructions:</span>
                    "{activeOrder.deliveryNotes}"
                  </div>
                )}
              </div>

              {/* In-Cockpit Quick Actions */}
              <div className="pt-2 border-t border-[var(--line)] flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleInsertOrderStatus}
                  className="px-2.5 py-1.5 rounded-lg bg-[#2ED8B6]/20 hover:bg-[#2ED8B6]/30 text-[#2ED8B6] border border-[#2ED8B6]/40 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Insert Status in Reply</span>
                </button>

                <button
                  type="button"
                  onClick={handleProcessRefund}
                  disabled={isRefunding || activeOrder.status === "refunded"}
                  className="px-2.5 py-1.5 rounded-lg bg-[#FF5C5C]/15 hover:bg-[#FF5C5C]/25 text-[#FF8585] border border-[#FF5C5C]/30 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRefunding ? <RefreshCw className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                  <span>{activeOrder.status === "refunded" ? "Refunded" : `Refund $${activeOrder.total.toFixed(2)}`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNotify?.(`Resent SMS tracking link to ${activeOrder.customerPhone}`, "success");
                    onInsertReply?.(
                      `We have resent your live delivery tracking link via SMS to ${activeOrder.customerPhone}. You can follow your driver's real-time route directly from your phone.`
                    );
                  }}
                  className="px-2 py-1.5 rounded-lg bg-[#141C26] hover:bg-[#1E2B3A] text-[#B4C2D0] border border-[var(--line)] text-[10.5px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Truck className="w-3 h-3" />
                  <span>Resend Tracking SMS</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-[#8E9AA8] font-mono">No order found matching criteria.</div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STORE MENU & REAL-TIME CATALOG */}
      {/* ========================================================================= */}
      {activeTab === "menu" && (
        <div className="space-y-2.5">
          {/* Menu Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#6B7C8D]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, ingredients, allergens (e.g. Asun, peanut, spicy)..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#090D14] border border-[var(--line)] rounded-xl text-xs font-mono text-[#EAF1F8] placeholder-[#6B7C8D] focus:outline-none focus:border-[#F5A623]"
            />
          </div>

          {/* Menu Items List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-[#0D131C] border border-[var(--line)] hover:border-[#F5A623]/40 transition-colors space-y-1.5 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#EAF1F8]">{item.name}</span>
                    <span className="text-[10px] text-[#F5A623] ml-2">${item.price.toFixed(2)}</span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      item.stockStatus === "in_stock"
                        ? "bg-[#4CC38A]/15 text-[#4CC38A]"
                        : item.stockStatus === "low_stock"
                        ? "bg-[#F5A623]/15 text-[#F5A623]"
                        : "bg-[#FF5C5C]/15 text-[#FF5C5C]"
                    }`}
                  >
                    {item.stockStatus.replace(/_/g, " ")} ({item.stockCount})
                  </span>
                </div>

                <p className="text-[10.5px] text-[#B4C2D0] leading-snug">{item.description}</p>

                <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-[var(--line)] text-[9.5px]">
                  <div className="flex flex-wrap gap-1">
                    {item.dietary.map((d, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-[#182332] text-[#2ED8B6]">
                        {d}
                      </span>
                    ))}
                    {item.allergens.map((a, i) => (
                      <span
                        key={i}
                        className={`px-1.5 py-0.5 rounded ${
                          a === "None" ? "bg-[#182332] text-[#8E9AA8]" : "bg-[#FF5C5C]/15 text-[#FF8585] font-bold"
                        }`}
                      >
                        {a === "None" ? "No Allergens" : `⚠️ ${a}`}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInsertMenuItem(item)}
                    className="text-[10px] text-[#F5A623] hover:underline flex items-center gap-1 cursor-pointer font-bold shrink-0"
                  >
                    <span>Insert in Reply &rarr;</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STORE POLICIES & HOURS */}
      {/* ========================================================================= */}
      {activeTab === "policy" && (
        <div className="space-y-2 font-mono text-xs bg-[#0D131C] p-3 rounded-xl border border-[var(--line)]">
          <div className="space-y-1">
            <span className="text-[10px] uppercase text-[#F5A623] font-bold">Store Hours (Main Kitchen):</span>
            <p className="text-[11px] text-[#B4C2D0]">Monday – Sunday: 11:00 AM – 10:30 PM EST</p>
            <p className="text-[10px] text-[#8E9AA8]">Late night delivery available Fri–Sat until 11:30 PM.</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[var(--line)]">
            <span className="text-[10px] uppercase text-[#F5A623] font-bold">Delivery & Radius:</span>
            <p className="text-[11px] text-[#B4C2D0]">Local Driver dispatch radius: 8.5 miles.</p>
            <p className="text-[10px] text-[#8E9AA8]">Orders over $50 qualify for complimentary delivery.</p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[var(--line)]">
            <span className="text-[10px] uppercase text-[#F5A623] font-bold">Refund & Quality Guarantee:</span>
            <p className="text-[11px] text-[#B4C2D0]">
              If food arrives cold, damaged, or items are missing, operators can issue instant store credit or full refund within 2 hours of delivery receipt.
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--line)] flex justify-end">
            <button
              type="button"
              onClick={() => {
                onInsertReply?.(
                  "Asun Palace Store Hours: Mon–Sun 11:00 AM – 10:30 PM EST. We deliver within an 8.5-mile radius. We guarantee 100% fresh delivery — if you have any issue with your order, we can replace it immediately or issue a full refund."
                );
                onNotify?.("Inserted store policies into reply composer", "info");
              }}
              className="px-2.5 py-1 rounded-lg bg-[#F5A623]/20 hover:bg-[#F5A623]/30 text-[#F5A623] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Insert Store Policy in Reply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
