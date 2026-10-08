import { createContext } from "react";
import type {
  CustomStyle,
  SavedStyle,
} from "../../services/appearance/customStyle.ts";
import type { readCustomStyle } from "../../services/appearance/customStyle.ts";
import type {
  saveCustomStyle,
  saveNamedStyle,
} from "../../services/appearance/customStyle.ts";

export const AppearanceContext = createContext<
  | (ReturnType<typeof readCustomStyle> & {
      style: CustomStyle;
      library: SavedStyle[];
      applyStyle: typeof saveCustomStyle;
      saveStyle: typeof saveNamedStyle;
    })
  | null
>(null);
