import type { ReactNode } from "react";
export function Heading({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <h1>
          {title}
          <span className="lime">.</span>
        </h1>
        <p>{children}</p>
      </div>
    </div>
  );
}
