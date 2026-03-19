import type { InputHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

type RangeProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Range({ className, ...props }: RangeProps) {
  return (
    <input
      {...props}
      className={cn("vf-range w-full cursor-pointer appearance-none bg-transparent", className)}
      type="range"
    />
  );
}
