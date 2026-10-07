import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { GenrePicker } from "../../src/components/ui/GenrePicker.tsx";

test("cinque preferenze: il sesto genere resta bloccato finché si libera un posto", () => {
  const genres = ["Trap", "Indie", "Rock", "Pop", "House", "Techno"];
  function Picker() {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <GenrePicker genres={genres} selected={selected} onChange={setSelected} />
    );
  }
  render(<Picker />);
  for (const genre of genres.slice(0, 5))
    fireEvent.click(screen.getByRole("button", { name: genre }));
  const sixth = screen.getByRole<HTMLButtonElement>("button", {
    name: "Techno",
  });
  expect(sixth.disabled).toBe(true);
  fireEvent.click(sixth);
  expect(sixth.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Trap" }));
  expect(sixth.disabled).toBe(false);
  fireEvent.click(sixth);
  expect(sixth.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("status").textContent).toContain("5/5");
});
