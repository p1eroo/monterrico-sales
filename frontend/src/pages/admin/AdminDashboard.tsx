import { Users, Shield, FileSearch, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

const adminModules = [
  {
    title: 'Usuarios',
    description: 'Gestión global de usuarios y asignación de áreas',
    icon: Users,
    href: '/admin/users',
    color: 'bg-blue-500',
  },
  {
    title: 'Roles y Permisos',
    description: 'Definición de permisos por rol del sistema',
    icon: Shield,
    href: '/admin/users?tab=roles', // Podemos reutilizar la pestaña de roles en la vista de usuarios
    color: 'bg-purple-500',
  },
  {
    title: 'Auditoría',
    description: 'Registro detallado de cambios y actividad',
    icon: FileSearch,
    href: '/admin/audit',
    color: 'bg-amber-500',
  },
  {
    title: 'Configuración',
    description: 'Ajustes globales de la plataforma',
    icon: Settings,
    href: '/settings',
    color: 'bg-slate-500',
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de Administrador"
        description="Gestión centralizada del CRM y control de accesos"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {adminModules.map((module) => (
          <Card 
            key={module.title}
            className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
            onClick={() => navigate(module.href)}
          >
            <CardContent className="p-6">
              <div className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${module.color} text-white`}>
                <module.icon size={24} />
              </div>
              <h3 className="mb-2 font-semibold">{module.title}</h3>
              <p className="text-sm text-muted-foreground">
                {module.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
