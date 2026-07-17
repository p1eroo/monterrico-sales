import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import {
  Briefcase,
  Car,
  ArrowRight,
  Loader2,
  Shield,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { toast } from '@/lib/notify';
import { useTheme } from "next-themes";
import bgClaro from "@/assets/select_claro.webp";
import bgOscuro from "@/assets/select_oscuro.webp";

const areas = [
  {
    id: "comercial" as const,
    name: "Comercial",
    imageDark: "/assets/comercial_bg_dark.png",
    imageLight: "/assets/comercial_bg_light.png",
  },
  {
    id: "flota" as const,
    name: "Flota",
    imageDark: "/assets/flota_bg_dark.png",
    imageLight: "/assets/flota_bg_light.png",
  },
  {
    id: "marketing" as const,
    name: "Marketing",
    imageDark: "/assets/marketing.webp",
    imageLight: "/assets/marketing.webp",
  },
];

export default function AreaSelect() {
  const navigate = useNavigate();
  const setArea = useAppStore((s) => s.setArea);
  const currentUser = useAppStore((s) => s.currentUser);
  const [selecting, setSelecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const backgroundStyle = {
    backgroundImage: `url(${resolvedTheme === "light" ? bgClaro : bgOscuro})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  const isAdmin = currentUser.role === "admin";
  const userAllowedAreas = currentUser.allowedAreas || [];

  const handleSelect = (areaId: "comercial" | "flota" | "marketing" | "admin") => {
    if (areaId !== "admin" && !isAdmin && !userAllowedAreas.includes(areaId)) {
      toast.error("Acceso restringido: No tienes permisos para esta área.");
      return;
    }

    setSelecting(true);
    setSelectedId(areaId);
    setArea(areaId);
    if (areaId === "admin") {
      navigate("/admin");
    } else if (areaId === "marketing") {
      navigate("/marketing");
    } else {
      navigate(areaId === "flota" ? "/flota" : "/dashboard");
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4 transition-all duration-500"
      style={{
        ...backgroundStyle,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* Botón de Administrador arriba a la derecha */}
      {isAdmin && (
        <div
          style={{
            position: "absolute",
            top: "1.5rem",
            right: "1.5rem",
            zIndex: 50,
          }}
        >
          <button
            onClick={() => handleSelect("admin")}
            disabled={selecting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.75rem",
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.05)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
              color: isDark ? "white" : "#1e293b",
              fontSize: "0.875rem",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)";
              e.currentTarget.style.borderColor = isDark
                ? "rgba(255, 255, 255, 0.2)"
                : "rgba(0, 0, 0, 0.2)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.05)";
              e.currentTarget.style.borderColor = isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)";
            }}
          >
            <Shield size={18} />
            Administrador
          </button>
        </div>
      )}

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "1260px",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "2rem",
            gridTemplateColumns: "repeat(3, 1fr)",
          }}
        >
          {areas.map((area) => {
            const isSelected = selectedId === area.id;
            const isHovered = hoveredId === area.id;
            const isAllowed = isAdmin || userAllowedAreas.includes(area.id);
            const areaImage = isDark ? area.imageDark : area.imageLight;

            return (
              <button
                key={area.id}
                onClick={() => handleSelect(area.id)}
                onMouseEnter={() => setHoveredId(area.id)}
                onMouseLeave={() => setHoveredId(null)}
                disabled={selecting || !isAllowed}
                style={{
                  position: "relative",
                  height: "420px",
                  borderRadius: "1.5rem",
                  overflow: "hidden",
                  border: isSelected
                    ? "2px solid #13944C"
                    : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  background: isDark ? "#1e293b" : "#f8fafc",
                  cursor: isAllowed && !selecting ? "pointer" : "not-allowed",
                  transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform:
                    isHovered && isAllowed
                      ? "translateY(-8px) scale(1.02)"
                      : "scale(1)",
                  boxShadow:
                    isHovered && isAllowed
                      ? isDark
                        ? "0 20px 40px rgba(0,0,0,0.4)"
                        : "0 20px 40px rgba(0,0,0,0.1)"
                      : isDark
                        ? "0 10px 20px rgba(0,0,0,0.2)"
                        : "0 10px 20px rgba(0,0,0,0.05)",
                  opacity: isAllowed ? 1 : 0.4,
                }}
              >
                {/* Background Image */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${areaImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    transition: "transform 0.7s ease",
                    transform:
                      isHovered && isAllowed ? "scale(1.1)" : "scale(1)",
                  }}
                />

                {/* Overlays */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: isAllowed
                      ? isDark
                        ? "linear-gradient(to top, rgba(10, 15, 29, 0.95) 0%, rgba(10, 15, 29, 0.4) 50%, rgba(10, 15, 29, 0.2) 100%)"
                        : "linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.1) 100%)"
                      : isDark
                        ? "rgba(10, 15, 29, 0.8)"
                        : "rgba(255, 255, 255, 0.8)",
                  }}
                />

                {!isAllowed && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 30,
                      color: isDark ? "white" : "#1e293b",
                      gap: "1rem",
                    }}
                  >
                    <Lock size={32} />
                    <span
                      style={{
                        fontWeight: "600",
                        fontSize: "1rem",
                        opacity: 0.8,
                      }}
                    >
                      Acceso Restringido
                    </span>
                  </div>
                )}

                <div
                  style={{
                    position: "absolute",
                    bottom: "2rem",
                    left: "2rem",
                    right: "2rem",
                    zIndex: 20,
                    textAlign: "left",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "2rem",
                      fontWeight: "800",
                      color: isDark ? "white" : "#1e293b",
                      marginBottom: "0.75rem",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {area.name}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "1rem",
                      fontWeight: "600",
                      color: isHovered
                        ? "#13944C"
                        : isDark
                          ? "white"
                          : "#1e293b",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {isSelected && selecting ? (
                      <>
                        <Loader2
                          size={20}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                        <span>Entrando...</span>
                      </>
                    ) : isAllowed ? (
                      <>
                        <span>Acceder al área</span>
                        <ArrowRight
                          size={20}
                          style={{
                            transform: isHovered
                              ? "translateX(4px)"
                              : "translateX(0)",
                            transition: "transform 0.3s ease",
                          }}
                        />
                      </>
                    ) : (
                      <span style={{ opacity: 0.5 }}>No disponible</span>
                    )}
                  </div>
                </div>

                {/* Decorative border glow on hover */}
                {isHovered && isAllowed && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: "2px solid rgba(19, 148, 76, 0.5)",
                      borderRadius: "1.5rem",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
