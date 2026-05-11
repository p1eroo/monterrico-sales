import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { Briefcase, Car, ArrowRight, Loader2, Shield, Lock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const areas = [
  {
    id: 'comercial' as const,
    name: 'Comercial',
    description: 'Gestión de clientes, oportunidades y pipeline de ventas',
    icon: Briefcase,
  },
  {
    id: 'flota' as const,
    name: 'Flota',
    description: 'Gestión de prospectos, conductores y flota vehicular',
    icon: Car,
  },
];

export default function AreaSelect() {
  const navigate = useNavigate();
  const setArea = useAppStore((s) => s.setArea);
  const currentUser = useAppStore((s) => s.currentUser);
  const [selecting, setSelecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';

  const userAllowedAreas = currentUser.allowedAreas || [];
  
  const handleSelect = (areaId: 'comercial' | 'flota' | 'admin') => {
    // Verificar si tiene permiso para esta área (excepto admin que se controla por rol)
    if (areaId !== 'admin' && !isAdmin && !userAllowedAreas.includes(areaId)) {
      toast.error('Acceso restringido: No tienes permisos para esta área.');
      return;
    }

    setSelecting(true);
    setSelectedId(areaId);
    setArea(areaId);
    // Redirigir según el área seleccionada
    if (areaId === 'admin') {
      navigate('/admin');
    } else {
      navigate(areaId === 'flota' ? '/flota' : '/dashboard');
    }
  };

  return (
    <div 
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      }}
    >
      {/* Botón de Administrador arriba a la derecha */}
      {isAdmin && (
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
          <button
            onClick={() => handleSelect('admin')}
            disabled={selecting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Shield size={18} />
            Administrador
          </button>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10rem', right: '-10rem', width: '20rem', height: '20rem', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-10rem', left: '-10rem', width: '20rem', height: '20rem', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '600px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white' }}>TM</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
            Selecciona tu área de trabajo
          </h1>
          <p style={{ color: '#94a3b8' }}>
            Elige el módulo al que deseas acceder durante esta sesión
          </p>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {areas.map((area) => {
            const Icon = area.icon;
            const isSelected = selectedId === area.id;
            const isFlota = area.id === 'flota';
            const isAllowed = isAdmin || userAllowedAreas.includes(area.id);
            
            const bgGradient = isAllowed
              ? (isFlota 
                ? 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)'
                : 'linear-gradient(135deg, #475569 0%, #334155 50%, #1e293b 100%)')
              : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';

            return (
              <button
                key={area.id}
                onClick={() => handleSelect(area.id)}
                disabled={selecting}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '1rem',
                  border: isSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  background: bgGradient,
                  padding: '2rem',
                  textAlign: 'left',
                  cursor: selecting ? 'not-allowed' : 'pointer',
                  opacity: (!isAllowed) ? 0.6 : (selecting && !isSelected ? 0.5 : 1),
                  transition: 'all 0.3s ease',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                {!isAllowed && (
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 20 }}>
                    <Lock size={16} color="rgba(255,255,255,0.5)" />
                  </div>
                )}
                <div style={{ position: 'absolute', right: '-2rem', top: '-2rem', width: '8rem', height: '8rem', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(40px)' }} />
                
                <div style={{ position: 'relative', zIndex: 10 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', marginBottom: '1rem' }}>
                    <Icon size={28} color="white" />
                  </div>

                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'white', marginBottom: '0.5rem' }}>
                    {area.name}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
                    {area.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: 'white' }}>
                    {isSelected && selecting ? (
                      <>
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} />
                        <span>Entrando...</span>
                      </>
                    ) : isAllowed ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        Continuar
                        <ArrowRight size={16} />
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Acceso no permitido</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
          Podrás cambiar de área en cualquier momento desde el sidebar
        </p>
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