import { cn } from "@/lib/utils";

type LocationMapEmbedProps = {
  latitude: number;
  longitude: number;
  className?: string;
};

export function googleMapsEmbedUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=16&output=embed`;
}

export function LocationMapEmbed({ latitude, longitude, className }: LocationMapEmbedProps) {
  const embedUrl = googleMapsEmbedUrl(latitude, longitude);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/60 bg-muted/20", className)}>
      <iframe
        title="Mapa de ubicación"
        src={embedUrl}
        className="h-[200px] w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}

export function hasValidCoordinates(lat?: number, lng?: number): boolean {
  return lat != null && lng != null && !(lat === 0 && lng === 0);
}
