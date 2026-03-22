import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[132px] w-full rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-ring",
        className,
      )}
    />
  );
}
