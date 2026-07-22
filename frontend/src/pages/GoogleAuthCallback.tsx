import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '@/store';

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const setGoogleConnected = useAppStore((s) => s.setGoogleConnected);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const connected = searchParams.get('connected');
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (connected === 'true') {
      setGoogleConnected(true);
      setStatus('success');
      setTimeout(() => navigate('/profile?tab=integraciones', { replace: true }), 1500);
      return;
    }

    if (error) {
      if (error === 'no_state') {
        setErrorMsg('Error de conexión: falta estado de verificación');
      } else if (error === 'link_failed') {
        setErrorMsg('No se pudo vincular tu cuenta de Google. Intenta de nuevo desde Integraciones.');
      } else {
        setErrorMsg(error);
      }
      setStatus('error');
      return;
    }

    if (!token) {
      setErrorMsg('No se recibió el token de autenticación');
      setStatus('error');
      return;
    }

    try {
      localStorage.setItem('accessToken', token);
      login();
      setGoogleConnected(true);
      setStatus('success');
      setTimeout(() => navigate('/profile?tab=integraciones', { replace: true }), 1500);
    } catch {
      setErrorMsg('Error al procesar la autenticación');
      setStatus('error');
    }
  }, [searchParams, navigate, login, setGoogleConnected]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Conectando con Google…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto size-12 text-[#13944C]" />
            <p className="mt-4 text-lg font-semibold text-foreground">¡Google conectado!</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirigiendo a integraciones…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto size-12 text-destructive" />
            <p className="mt-4 text-lg font-semibold text-destructive">Error</p>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
            <button
              className="mt-4 text-sm text-primary underline"
              onClick={() => navigate('/profile?tab=integraciones')}
            >
              Volver a integraciones
            </button>
          </>
        )}
      </div>
    </div>
  );
}
