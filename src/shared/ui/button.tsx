import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { cn } from "@/shared/lib/cn";

const buttonVariants = {
  primary:
    "border-primary/70 bg-primary text-primary-foreground shadow-glow hover:bg-primary/90",
  secondary:
    "border-border bg-panel text-foreground hover:border-primary/40 hover:bg-panel-strong",
  ghost:
    "border-transparent bg-transparent text-muted-foreground hover:bg-panel hover:text-foreground",
  danger:
    "border-danger/50 bg-danger/15 text-danger hover:bg-danger/20",
};

const buttonSizes = {
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
  icon: "h-11 w-11",
};

type SharedButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

type ButtonProps = SharedButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: never;
  };

type LinkButtonProps = SharedButtonProps &
  Omit<LinkProps, "className"> & {
    to: LinkProps["to"];
  };

function buttonClassName({
  className,
  size = "md",
  variant = "primary",
}: SharedButtonProps) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export function Button(props: ButtonProps | LinkButtonProps) {
  if ("to" in props) {
    const {
      children,
      className,
      size,
      to,
      variant = "primary",
      ...rest
    } = props as LinkButtonProps;
    return (
      <Link
        {...rest}
        className={buttonClassName({ className, size, variant, children })}
        to={to}
      >
        {children}
      </Link>
    );
  }

  const { children, className, size, type = "button", variant = "primary", ...rest } =
    props;

  return (
    <button
      {...rest}
      className={buttonClassName({ className, size, variant, children })}
      type={type}
    >
      {children}
    </button>
  );
}
