import { AudioLines } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/shared/lib/cn";

type BrandMarkProps = {
  className?: string;
  compact?: boolean;
  to?: string;
};

export function BrandMark({
  className,
  compact = false,
  to = "/",
}: BrandMarkProps) {
  return (
    <Link
      to={to}
      className={cn("inline-flex items-center gap-3 text-foreground", className)}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-panel shadow-panel">
        <AudioLines className="h-5 w-5 text-primary" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
            VoiceForge
          </span>
          <span className="text-base font-semibold tracking-tight">
            AI Speaking Coach
          </span>
        </span>
      )}
    </Link>
  );
}
