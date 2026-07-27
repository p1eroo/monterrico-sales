import { useEffect, useState } from "react";
import type { Conductor } from "@/lib/flotaConductoresApi";
import { cn } from "@/lib/utils";

function conductorInitials(conductor: Conductor): string {
  const parts = `${conductor.nombres ?? ""} ${conductor.apellidos ?? ""}`.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return "—";
  return parts
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

type ConductorAvatarProps = {
  conductor: Conductor;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "size-9 text-sm",
  md: "size-12 text-base",
  lg: "size-20 text-xl",
} as const;

export function ConductorAvatar({ conductor, size = "sm", className }: ConductorAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const foto = conductor.imaasoc?.trim();
  const nombre = `${conductor.nombres ?? ""} ${conductor.apellidos ?? ""}`.trim();
  const showImage = Boolean(foto) && !imgError;

  useEffect(() => {
    setImgError(false);
  }, [foto]);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted",
        sizeClass[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={foto}
          alt={nombre || "Conductor"}
          className="size-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-medium text-primary">{conductorInitials(conductor)}</span>
      )}
    </div>
  );
}
