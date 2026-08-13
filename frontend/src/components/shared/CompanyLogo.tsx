import { useMemo, useState } from 'react';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { API_BASE } from '@/lib/api';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { cn } from '@/lib/utils';

type LogoSource = 'external' | 'company' | 'domain';

type CompanyLogoProps = {
  companyId?: string | null;
  domain?: string | null;
  externalLogoUrl?: string | null;
  className?: string;
  iconClassName?: string;
};

const failedSrc = new Set<string>();

function buildSources({
  companyId,
  domain,
  externalLogoUrl,
}: CompanyLogoProps): { kind: LogoSource; src: string }[] {
  const out: { kind: LogoSource; src: string }[] = [];
  const ext = externalLogoUrl?.trim();
  if (ext) out.push({ kind: 'external', src: ext });
  if (companyId && isLikelyCompanyCuid(companyId)) {
    out.push({ kind: 'company', src: `${API_BASE}/companies/${companyId}/logo` });
  }
  const dom = domain?.trim();
  if (dom) {
    out.push({
      kind: 'domain',
      src: `${API_BASE}/companies/logo-by-domain?domain=${encodeURIComponent(dom)}`,
    });
  }
  return out;
}

export function CompanyLogo({
  companyId,
  domain,
  externalLogoUrl,
  className,
  iconClassName,
}: CompanyLogoProps) {
  const sources = useMemo(
    () => buildSources({ companyId, domain, externalLogoUrl }),
    [companyId, domain, externalLogoUrl],
  );

  const [index, setIndex] = useState(() => {
    const first = sources[0];
    return first && failedSrc.has(first.src) ? sources.findIndex((s) => !failedSrc.has(s.src)) : 0;
  });

  const current = sources[index >= 0 ? index : 0];

  if (!current || failedSrc.has(current.src)) {
    return <Buildings2SvgIcon className={cn('size-4 text-muted-foreground', iconClassName)} />;
  }

  return (
    <img
      src={current.src}
      alt=""
      className={cn('size-6 rounded object-contain', className)}
      onError={() => {
        failedSrc.add(current.src);
        const next = sources.findIndex((s, i) => i > index && !failedSrc.has(s.src));
        if (next >= 0) {
          setIndex(next);
        } else {
          setIndex(sources.length);
        }
      }}
    />
  );
}

export function CompanyLogoBox({
  companyId,
  domain,
  externalLogoUrl,
  className,
}: CompanyLogoProps & { className?: string }) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted',
        className,
      )}
    >
      <CompanyLogo
        companyId={companyId}
        domain={domain}
        externalLogoUrl={externalLogoUrl}
      />
    </div>
  );
}
