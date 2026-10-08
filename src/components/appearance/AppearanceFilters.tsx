import {
  mix,
  type CustomStyle,
} from "../../services/appearance/customStyle.ts";

export function AppearanceFilters({
  style,
  id,
}: {
  style: CustomStyle;
  id: string;
}) {
  const colors = [
    "#060709",
    style.brandSecondary,
    style.brandPrimary,
    mix("#ffffff", style.brandPrimary, 0.65),
    "#ffffff",
  ];
  const channel = (index: number) =>
    colors
      .map((hex) =>
        (parseInt(hex.slice(index, index + 2), 16) / 255).toFixed(4),
      )
      .join(" ");
  return (
    <svg
      className="appearance-filters"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={channel(1)} />
            <feFuncG type="table" tableValues={channel(3)} />
            <feFuncB type="table" tableValues={channel(5)} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
