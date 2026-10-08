import { useEffect, useRef, useState } from "react";
import Dialog from "../Dialog.tsx";

interface AvatarCropDialogProps {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}

export default function AvatarCropDialog({
  file,
  onCancel,
  onConfirm,
}: AvatarCropDialogProps) {
  const [source, setSource] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    offset: typeof offset;
  } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState(360);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setStageSize(stage.clientWidth));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  function clampOffset(next: typeof offset, nextZoom = zoom) {
    const limitX = Math.max(0, (dimensions.width * nextZoom - 360) / 2);
    const limitY = Math.max(0, (dimensions.height * nextZoom - 360) / 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, next.x)),
      y: Math.max(-limitY, Math.min(limitY, next.y)),
    };
  }

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    setDimensions({ width: 0, height: 0 });
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const ratio = 360 / (stageRef.current?.clientWidth || 360);
    setOffset(
      clampOffset({
        x: drag.offset.x + (event.clientX - drag.x) * ratio,
        y: drag.offset.y + (event.clientY - drag.y) * ratio,
      }),
    );
  }

  async function confirm() {
    const image = imageRef.current;
    if (!image || !source || !dimensions.width) return;
    setSaving(true);
    try {
      const size = 640;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Impossibile preparare l’immagine.");
      const scale = (size / 360) * zoom;
      context.drawImage(
        image,
        (size - dimensions.width * scale) / 2 + offset.x * (size / 360),
        (size - dimensions.height * scale) / 2 + offset.y * (size / 360),
        dimensions.width * scale,
        dimensions.height * scale,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Impossibile preparare l’immagine.");
      await onConfirm(new File([blob], "profile.jpg", { type: "image/jpeg" }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      onClose={onCancel}
      className="avatar-crop-dialog"
      ariaLabel="Ritaglia immagine profilo"
    >
      <div className="crop-header">
        <div>
          <span className="eyebrow lime">NUOVA IMMAGINE</span>
          <h2>
            Ritaglia il tuo profilo<span className="lime">.</span>
          </h2>
        </div>
        <button
          className="dialog-close"
          type="button"
          onClick={onCancel}
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>
      <p className="hint">
        Trascina l’immagine e usa lo zoom per scegliere l’inquadratura.
      </p>
      <div
        ref={stageRef}
        className="crop-stage"
        onPointerDown={(event) => {
          setDrag({ x: event.clientX, y: event.clientY, offset });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {source && (
          <img
            ref={imageRef}
            src={source}
            alt="Anteprima immagine profilo"
            className="crop-image"
            onLoad={(event) => {
              const image = event.currentTarget;
              const scale = Math.max(
                360 / image.naturalWidth,
                360 / image.naturalHeight,
              );
              setDimensions({
                width: image.naturalWidth * scale,
                height: image.naturalHeight * scale,
              });
            }}
            style={{
              width: dimensions.width
                ? (dimensions.width * stageSize) / 360
                : undefined,
              height: dimensions.height
                ? (dimensions.height * stageSize) / 360
                : undefined,
              transform: `translate(-50%, -50%) translate(${(offset.x * stageSize) / 360}px, ${(offset.y * stageSize) / 360}px) scale(${zoom})`,
            }}
          />
        )}
        <span className="crop-mask" aria-hidden="true" />
      </div>
      <div className="crop-zoom">
        <span aria-hidden="true">−</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          aria-label="Zoom immagine"
          onChange={(event) => {
            const nextZoom = Number(event.target.value);
            setZoom(nextZoom);
            setOffset(clampOffset(offset, nextZoom));
          }}
        />
        <span aria-hidden="true">+</span>
      </div>
      <div className="crop-actions">
        <button
          className="btn secondary"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Annulla
        </button>
        <button
          className="btn"
          type="button"
          disabled={saving}
          onClick={() => void confirm()}
        >
          {saving ? "Salvataggio…" : "Usa questa immagine"}
        </button>
      </div>
    </Dialog>
  );
}
