import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SunSvgIcon } from '@/components/icons/SunSvgIcon';
import { MoonStarsSvgIcon } from '@/components/icons/MoonStarsSvgIcon';

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
      size="icon-sm"
      onClick={toggle}
      className={cn(
        'text-muted-foreground hover:text-[#13944C] hover:bg-[#13944C]/10'
      )}
      aria-label="Cambiar tema"
    >
      {mounted && resolvedTheme === 'dark' ? (
        <SunSvgIcon className="size-7" />
      ) : (
        <MoonStarsSvgIcon className="size-7" />
      )}
    </Button>
  );
}