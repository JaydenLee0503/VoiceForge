export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        panel: "hsl(var(--panel))",
        "panel-strong": "hsl(var(--panel-strong))",
        shell: "hsl(var(--shell))",
        border: "hsl(var(--border))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        muted: {
          foreground: "hsl(var(--muted-foreground))",
        },
        ring: "hsl(var(--ring))",
        danger: "hsl(var(--danger))",
      },
    },
  },
  plugins: [],
};
