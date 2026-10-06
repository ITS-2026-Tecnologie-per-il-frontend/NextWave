import { useEffect, useState } from "react";
import { rome } from "../domain/time.ts";
export function useRomeClock() {
  const [clock, setClock] = useState(rome);
  useEffect(() => {
    const timer = setInterval(() => setClock(rome()), 1000);
    return () => clearInterval(timer);
  }, []);
  return clock;
}
