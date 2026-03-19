import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  elevated?: boolean;
};

export function Panel({
  children,
  className,
  elevated = false,
  ...rest
}: PanelProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-3xl border border-border bg-panel/95 backdrop-blur",
        elevated && "shadow-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}
