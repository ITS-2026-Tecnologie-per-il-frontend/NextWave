import { useId, type CSSProperties } from "react";
import {
  styleVariables,
  type CustomStyle,
} from "../../services/appearance/customStyle.ts";
import { BrandLogo } from "../brand/BrandLogo.tsx";
import { AppearanceFilters } from "./AppearanceFilters.tsx";

export function StyleThumbnail({ style }: { style: CustomStyle }) {
  const filter = `wave-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  return (
    <span
      className="style-thumbnail"
      style={styleVariables(style) as CSSProperties}
      aria-hidden="true"
    >
      <AppearanceFilters style={style} id={filter} />
      <span className="thumbnail-sidebar">
        <BrandLogo />
        <i />
        <i />
        <i />
      </span>
      <span className="thumbnail-main">
        <span className="thumbnail-wave">
          <img
            src="/images/art.png"
            alt=""
            style={{ filter: `url(#${filter})` }}
          />
        </span>
        <span className="thumbnail-cards">
          <i />
          <i />
          <i />
        </span>
        <span className="thumbnail-action" />
      </span>
    </span>
  );
}
