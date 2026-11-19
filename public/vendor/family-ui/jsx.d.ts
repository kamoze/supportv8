// JSX typings for the family custom elements, for React (17+) apps.
// Vendored apps: add `/// <reference path="<vendor>/jsx.d.ts" />` once, or list
// this file in tsconfig "include". Package consumers:
//   import type {} from "@kamoze/servicev8-family-ui/jsx";
// Attribute names match each element's observedAttributes. Use the hyphenated
// names (e.g. runtime-url): React may render before family.js defines the
// elements, and then a camelCase prop becomes a lowercase attribute. Set object
// properties (nav and tools on sv8-sidebar, menu on sv8-header) through a ref
// after customElements.whenDefined().
import type React from "react";

type AppKey = "runtime" | "tasks" | "forge" | "knowledge" | "support" | "voice" | "growth" | "studio" | "collections" | "dominion" | (string & {});
type Flag = boolean | "" | undefined;

type Common = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  class?: string;
  [dataOrAria: `data-${string}` | `aria-${string}`]: string | number | boolean | undefined;
};

export interface Sv8ShellAttributes extends Common {
  app?: AppKey;
  mode?: "standalone" | "embedded";
  "runtime-url"?: string;
  theme?: "light" | "dark";
  base?: "charcoal" | "navy";
  sidebar?: "expanded" | "collapsed";
  panel?: "expanded" | "collapsed";
}

export interface Sv8SidebarAttributes extends Common {
  active?: string;
  tenant?: string;
  "tenant-sub"?: string;
  "tenant-logo"?: string;
  "user-name"?: string;
  /** Flag: render a sign-out button that fires `sv8-sign-out`. */
  "sign-out"?: Flag;
  "sign-out-href"?: string;
  "sign-out-action"?: string;
  "sign-out-csrf"?: string;
  "sign-out-csrf-field"?: string;
  csrf?: string;
  "csrf-field"?: string;
  "home-href"?: string;
  "nav-label"?: string;
  "nav-id"?: string;
  "no-theme-toggle"?: Flag;
  "drawer-filter"?: string;
}

export interface Sv8HeaderAttributes extends Common {
  heading?: string;
  search?: string;
  "search-value"?: string;
  credits?: string;
  status?: string;
  "status-tone"?: "neutral" | "ok" | "warning" | "error";
  ask?: string;
  action?: string;
  "action-menu"?: Flag;
  "user-name"?: string;
}

export interface Sv8SidePanelAttributes extends Common {
  heading?: string;
}

export interface Sv8LogoAttributes extends Common {
  app?: AppKey;
  size?: number | string;
  decorative?: Flag;
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "sv8-shell": Sv8ShellAttributes;
      "sv8-sidebar": Sv8SidebarAttributes;
      "sv8-header": Sv8HeaderAttributes;
      "sv8-side-panel": Sv8SidePanelAttributes;
      "sv8-logo": Sv8LogoAttributes;
    }
  }
}
