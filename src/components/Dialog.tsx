import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
export default function Dialog({
  children,
  onClose,
  reveal = false,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onClose: () => void;
  reveal?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={reveal ? `revealmodal ${className}` : className}
      aria-label={ariaLabel || (reveal ? "Classifica del contest concluso" : "Messaggio Next Wave")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
