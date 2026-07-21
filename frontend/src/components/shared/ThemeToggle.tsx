import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { topbarActionButtonClass } from '@/lib/topbarIconStyles';
import { SunFogSvgIcon } from '@/components/icons/SunFogSvgIcon';
import { MoonFogSvgIcon } from '@/components/icons/MoonFogSvgIcon';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function toggle() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn(topbarActionButtonClass)}
      aria-label="Cambiar tema"
    >
      {mounted && resolvedTheme === 'dark' ? (
        <MoonFogSvgIcon className="size-8" />
      ) : (
        <SunFogSvgIcon className="size-8" />
      )}
    </Button>
  );
}