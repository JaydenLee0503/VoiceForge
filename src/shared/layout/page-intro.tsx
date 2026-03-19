import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type PageIntroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
};

export function PageIntro({
  actions,
  className,
  description,
  eyebrow,
  title,
}: PageIntroProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl space-y-3">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        <p className="text-base leading-7 text-muted-foreground md:text-lg">
          {description}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
