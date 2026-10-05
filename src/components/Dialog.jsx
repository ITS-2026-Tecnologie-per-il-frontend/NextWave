import { useEffect, useRef } from "react";
export default function Dialog({ children, onClose, reveal = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={reveal ? "revealmodal" : ""}
      aria-label={
        reveal ? "Classifica del contest concluso" : "Messaggio Vibe Pulse"
      }
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
