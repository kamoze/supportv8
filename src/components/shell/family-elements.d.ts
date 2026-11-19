// JSX typings for the vendored @kamoze/servicev8-family-ui custom elements.
import type React from "react";

type FamilyElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  class?: string;
  [attribute: `${string}-${string}`]: string | boolean | undefined;
};

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "sv8-shell": FamilyElementProps & { app?: string; mode?: "standalone" | "embedded"; theme?: "light" | "dark"; base?: string; sidebar?: string; panel?: string };
      "sv8-sidebar": FamilyElementProps & { active?: string; tenant?: string };
    }
  }
}
