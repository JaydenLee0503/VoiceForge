import { cn } from "@/shared/lib/cn";

type ProgressBarProps = {
  value: number;
  className?: string;
  indicatorClassName?: string;
};

export function ProgressBar({
  className,
  indicatorClassName,
  value,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-panel-strong", className)}>
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-300",
          indicatorClassName,
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
