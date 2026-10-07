interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  button?: boolean;
  label?: string;
  onClick?: () => void;
  positionX?: number;
  positionY?: number;
}

export function Avatar({
  name,
  imageUrl,
  button = false,
  label,
  onClick,
  positionX = 50,
  positionY = 50,
}: AvatarProps) {
  const content = imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      style={{ objectPosition: `${positionX}% ${positionY}%` }}
    />
  ) : (
    (name || "Tu")[0].toUpperCase()
  );
  if (button) {
    return (
      <button className="avatar" aria-label={label} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="avatar">{content}</div>;
}
