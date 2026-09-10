"use client";

import React, { forwardRef } from "react";

export interface FlatIconProps extends React.HTMLAttributes<HTMLElement> {
  size?: number | string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  fill?: string;
}

function classSize(className?: string): string | undefined {
  const pixelMatch = className?.match(/(?:^|\s)w-\[(\d+(?:\.\d+)?)px\](?:\s|$)/);
  if (pixelMatch) return `${pixelMatch[1]}px`;
  const scaleMatch = className?.match(/(?:^|\s)w-(\d+(?:\.\d+)?)(?:\s|$)/);
  if (scaleMatch) return `${Number(scaleMatch[1]) / 4}rem`;
  return undefined;
}

function createFlatIcon(iconClass: string, displayName: string) {
  const Icon = forwardRef<HTMLElement, FlatIconProps>(function FlatIcon(
    {
      className = "",
      size,
      strokeWidth: _strokeWidth,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      fill: _fill,
      style,
      title,
      ...props
    },
    ref,
  ) {
    const fontSize = size === undefined
      ? classSize(className)
      : typeof size === "number"
        ? `${size}px`
        : size;
    const hasAccessibleName = Boolean(props["aria-label"] || title);

    return (
      <i
        {...props}
        ref={ref}
        aria-hidden={props["aria-hidden"] ?? (hasAccessibleName ? undefined : true)}
        className={`support-flat-icon fi ${iconClass} ${className}`.trim()}
        role={props.role ?? (hasAccessibleName ? "img" : undefined)}
        style={{ ...style, fontSize: fontSize || style?.fontSize }}
        title={title}
      />
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

export const Activity = createFlatIcon("fi-rr-wave-square", "Activity");
export const AlertCircle = createFlatIcon("fi-rr-exclamation", "AlertCircle");
export const AlertTriangle = createFlatIcon("fi-rr-triangle-warning", "AlertTriangle");
export const ArrowDown = createFlatIcon("fi-rr-arrow-down", "ArrowDown");
export const ArrowLeft = createFlatIcon("fi-rr-arrow-left", "ArrowLeft");
export const ArrowRight = createFlatIcon("fi-rr-arrow-right", "ArrowRight");
export const ArrowUpRight = createFlatIcon("fi-rr-arrow-up-right", "ArrowUpRight");
export const Award = createFlatIcon("fi-rr-award", "Award");
export const BarChart3 = createFlatIcon("fi-rr-chart-histogram", "BarChart3");
export const BookOpen = createFlatIcon("fi-rr-book-open-cover", "BookOpen");
export const Bot = createFlatIcon("fi-rr-robot", "Bot");
export const Brain = createFlatIcon("fi-rr-brain", "Brain");
export const Briefcase = createFlatIcon("fi-rr-briefcase", "Briefcase");
export const Bug = createFlatIcon("fi-rr-bug", "Bug");
export const Building = createFlatIcon("fi-rr-building", "Building");
export const Building2 = createFlatIcon("fi-rr-building", "Building2");
export const Camera = createFlatIcon("fi-rr-camera", "Camera");
export const Check = createFlatIcon("fi-rr-check", "Check");
export const CheckCheck = createFlatIcon("fi-rr-check-double", "CheckCheck");
export const CheckCircle2 = createFlatIcon("fi-rr-check-circle", "CheckCircle2");
export const CheckSquare = createFlatIcon("fi-rr-checkbox", "CheckSquare");
export const ChevronDown = createFlatIcon("fi-rr-angle-down", "ChevronDown");
export const ChevronLeft = createFlatIcon("fi-rr-angle-left", "ChevronLeft");
export const ChevronRight = createFlatIcon("fi-rr-angle-right", "ChevronRight");
export const ChevronUp = createFlatIcon("fi-rr-angle-up", "ChevronUp");
export const ChevronsLeft = createFlatIcon("fi-rr-angle-double-left", "ChevronsLeft");
export const ChevronsRight = createFlatIcon("fi-rr-angle-double-right", "ChevronsRight");
export const Clock = createFlatIcon("fi-rr-clock", "Clock");
export const Code = createFlatIcon("fi-rr-code-simple", "Code");
export const Code2 = createFlatIcon("fi-rr-code-simple", "Code2");
export const Copy = createFlatIcon("fi-rr-copy", "Copy");
export const CornerDownRight = createFlatIcon("fi-rr-arrow-turn-down-right", "CornerDownRight");
export const Cpu = createFlatIcon("fi-rr-microchip", "Cpu");
export const CreditCard = createFlatIcon("fi-rr-credit-card", "CreditCard");
export const Database = createFlatIcon("fi-rr-database", "Database");
export const DollarSign = createFlatIcon("fi-rr-dollar", "DollarSign");
export const Download = createFlatIcon("fi-rr-download", "Download");
export const Edit2 = createFlatIcon("fi-rr-pencil", "Edit2");
export const Edit3 = createFlatIcon("fi-rr-pencil", "Edit3");
export const ExternalLink = createFlatIcon("fi-rr-link-alt", "ExternalLink");
export const Eye = createFlatIcon("fi-rr-eye", "Eye");
export const EyeOff = createFlatIcon("fi-rr-eye-crossed", "EyeOff");
export const FileCheck = createFlatIcon("fi-rr-summary-check", "FileCheck");
export const FileCode = createFlatIcon("fi-rr-file-code", "FileCode");
export const FileText = createFlatIcon("fi-rr-document", "FileText");
export const Filter = createFlatIcon("fi-rr-filter", "Filter");
export const Flame = createFlatIcon("fi-rr-flame", "Flame");
export const FolderPlus = createFlatIcon("fi-rr-folder-plus-circle", "FolderPlus");
export const Frown = createFlatIcon("fi-rr-sad", "Frown");
export const Gauge = createFlatIcon("fi-rr-speedometer-kpi", "Gauge");
export const Globe = createFlatIcon("fi-rr-globe", "Globe");
export const HardHat = createFlatIcon("fi-rr-hard-hat", "HardHat");
export const Hash = createFlatIcon("fi-rr-hastag", "Hash");
export const Headphones = createFlatIcon("fi-rr-headset", "Headphones");
export const HeartPulse = createFlatIcon("fi-rr-heart-rate", "HeartPulse");
export const HelpCircle = createFlatIcon("fi-rr-interrogation", "HelpCircle");
export const Key = createFlatIcon("fi-rr-key", "Key");
export const KeyRound = createFlatIcon("fi-rr-key", "KeyRound");
export const Layers = createFlatIcon("fi-rr-layers", "Layers");
export const LayoutDashboard = createFlatIcon("fi-rr-dashboard", "LayoutDashboard");
export const LayoutGrid = createFlatIcon("fi-rr-apps", "LayoutGrid");
export const Lightbulb = createFlatIcon("fi-rr-bulb", "Lightbulb");
export const List = createFlatIcon("fi-rr-list", "List");
export const Loader2 = createFlatIcon("fi-rr-spinner", "Loader2");
export const Lock = createFlatIcon("fi-rr-lock", "Lock");
export const LogOut = createFlatIcon("fi-rr-sign-out-alt", "LogOut");
export const Mail = createFlatIcon("fi-rr-envelope", "Mail");
export const MapPin = createFlatIcon("fi-rr-marker", "MapPin");
export const Maximize2 = createFlatIcon("fi-rr-expand", "Maximize2");
export const Meh = createFlatIcon("fi-rr-meh", "Meh");
export const MessageSquare = createFlatIcon("fi-rr-comment-alt", "MessageSquare");
export const MessageSquareText = createFlatIcon("fi-rr-comment-alt-dots", "MessageSquareText");
export const MessagesSquare = createFlatIcon("fi-rr-comments", "MessagesSquare");
export const Mic = createFlatIcon("fi-rr-microphone", "Mic");
export const Minimize2 = createFlatIcon("fi-rr-compress", "Minimize2");
export const MoreVertical = createFlatIcon("fi-rr-menu-dots-vertical", "MoreVertical");
export const Moon = createFlatIcon("fi-rr-moon", "Moon");
export const Sun = createFlatIcon("fi-rr-sun", "Sun");
export const PanelLeftClose = createFlatIcon("fi-rr-sidebar-flip", "PanelLeftClose");
export const PanelLeftOpen = createFlatIcon("fi-rr-sidebar", "PanelLeftOpen");
export const PanelRightClose = createFlatIcon("fi-rr-sidebar", "PanelRightClose");
export const PanelRightOpen = createFlatIcon("fi-rr-sidebar-flip", "PanelRightOpen");
export const Paperclip = createFlatIcon("fi-rr-clip", "Paperclip");
export const Pause = createFlatIcon("fi-rr-pause", "Pause");
export const Phone = createFlatIcon("fi-rr-phone-call", "Phone");
export const PhoneCall = createFlatIcon("fi-rr-phone-call", "PhoneCall");
export const Play = createFlatIcon("fi-rr-play", "Play");
export const Plug = createFlatIcon("fi-rr-plug", "Plug");
export const Plus = createFlatIcon("fi-rr-plus", "Plus");
export const PlusCircle = createFlatIcon("fi-rr-add", "PlusCircle");
export const Radio = createFlatIcon("fi-rr-radio", "Radio");
export const RefreshCw = createFlatIcon("fi-rr-refresh", "RefreshCw");
export const RotateCcw = createFlatIcon("fi-rr-rotate-left", "RotateCcw");
export const Search = createFlatIcon("fi-rr-search", "Search");
export const Send = createFlatIcon("fi-rr-paper-plane", "Send");
export const Server = createFlatIcon("fi-rr-sql-server", "Server");
export const Settings = createFlatIcon("fi-rr-settings", "Settings");
export const Share2 = createFlatIcon("fi-rr-share", "Share2");
export const Shield = createFlatIcon("fi-rr-shield", "Shield");
export const ShieldAlert = createFlatIcon("fi-rr-shield-exclamation", "ShieldAlert");
export const ShieldCheck = createFlatIcon("fi-rr-shield-check", "ShieldCheck");
export const ShoppingBag = createFlatIcon("fi-rr-shopping-bag", "ShoppingBag");
export const Sliders = createFlatIcon("fi-rr-settings-sliders", "Sliders");
export const SlidersHorizontal = createFlatIcon("fi-rr-settings-sliders", "SlidersHorizontal");
export const Smartphone = createFlatIcon("fi-rr-smartphone", "Smartphone");
export const Smile = createFlatIcon("fi-rr-smile", "Smile");
export const Sparkles = createFlatIcon("fi-rr-sparkles", "Sparkles");
export const Star = createFlatIcon("fi-rr-star", "Star");
export const Tag = createFlatIcon("fi-rr-tags", "Tag");
export const Target = createFlatIcon("fi-rr-target", "Target");
export const Terminal = createFlatIcon("fi-rr-terminal", "Terminal");
export const Trash2 = createFlatIcon("fi-rr-trash", "Trash2");
export const TrendingDown = createFlatIcon("fi-rr-chart-line-up-down", "TrendingDown");
export const TrendingUp = createFlatIcon("fi-rr-chart-line-up", "TrendingUp");
export const Truck = createFlatIcon("fi-rr-truck-side", "Truck");
export const Upload = createFlatIcon("fi-rr-upload", "Upload");
export const User = createFlatIcon("fi-rr-user", "User");
export const UserCheck = createFlatIcon("fi-rr-user-check", "UserCheck");
export const UserPlus = createFlatIcon("fi-rr-user-add", "UserPlus");
export const Users = createFlatIcon("fi-rr-users-alt", "Users");
export const Volume2 = createFlatIcon("fi-rr-volume", "Volume2");
export const Wand2 = createFlatIcon("fi-rr-magic-wand", "Wand2");
export const Workflow = createFlatIcon("fi-rr-workflow", "Workflow");
export const Wrench = createFlatIcon("fi-rr-wrench-simple", "Wrench");
export const X = createFlatIcon("fi-rr-cross", "X");
export const Zap = createFlatIcon("fi-rr-bolt", "Zap");
export const ZoomIn = createFlatIcon("fi-rr-zoom-in", "ZoomIn");
export const ZoomOut = createFlatIcon("fi-rr-zoom-out", "ZoomOut");
