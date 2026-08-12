import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** Agente: tono verde de marca en modo claro */
  variant?: 'default' | 'agent';
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
};

const avatarColors = [
  'bg-purple-100 text-purple-700 dark:bg-purple-500 dark:text-white',
  'bg-blue-100 text-blue-700 dark:bg-blue-500 dark:text-white',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500 dark:text-white',
  'bg-amber-100 text-amber-800 dark:bg-amber-500 dark:text-white',
  'bg-rose-100 text-rose-700 dark:bg-rose-500 dark:text-white',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-500 dark:text-white',
  'bg-orange-100 text-orange-800 dark:bg-orange-500 dark:text-white',
  'bg-pink-100 text-pink-700 dark:bg-pink-500 dark:text-white',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getColorClass(name: string): string {
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;
  return avatarColors[index];
}

export function ChatpoolAvatar({ name, size = 'md', className, variant = 'default' }: AvatarProps) {
  const colorClass =
    variant === 'agent'
      ? 'bg-primary/15 text-primary dark:bg-primary dark:text-primary-foreground'
      : getColorClass(name);

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold shrink-0',
        colorClass,
        sizeClasses[size],
        className,
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
