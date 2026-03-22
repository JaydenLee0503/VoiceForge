import { cn } from "@/shared/lib/cn";

type Option<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  className,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 rounded-2xl border border-border bg-panel p-2",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              selected
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:bg-panel-strong hover:text-foreground",
            )}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
