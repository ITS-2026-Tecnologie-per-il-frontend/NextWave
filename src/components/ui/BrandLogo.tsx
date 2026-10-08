import { useId } from "react";
import full from "../../assets/nextwave-full.svg?raw";
import symbol from "../../assets/nextwave-symbol.svg?raw";

function tint(source: string) {
  return source.replace(/#[0-9a-f]{6}/gi, (hex) => {
    const [r, g, b] = [1, 3, 5].map(
      (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
    );
    if (hex.toLowerCase() === "#f5f5f5") return "var(--text, #f5f5f5)";
    if (hex.toLowerCase() === "#a3ff12")
      return "var(--custom-brand-primary, #a3ff12)";
    const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    const token = g > b ? "--custom-brand-primary" : "--custom-brand-secondary";
    const amount = Math.round(
      (lightness <= 0.5 ? lightness * 2 : (1 - lightness) * 2) * 100,
    );
    return `color-mix(in srgb, var(${token}, ${hex}) ${amount}%, ${lightness <= 0.5 ? "#000" : "#fff"})`;
  });
}
const templates = { full: tint(full), symbol: tint(symbol) };

export function BrandLogo({
  variant = "symbol",
  className = "",
}: {
  variant?: "full" | "symbol";
  className?: string;
}) {
  const id = useId().replace(/[^a-z0-9_-]/gi, "");
  const svg = templates[variant]
    .replace(/id="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`);
  return (
    <span
      className={`brand-vector ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
