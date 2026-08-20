import type { JSONContent } from '@tiptap/core';
import { BRAND } from './brand';

const RADIUS_PILL = 9999;

function fontStyle(partial?: {
  fontSize?: number | null;
  fontWeight?: number | null;
  lineHeight?: number | null;
  color?: string;
}) {
  return {
    fontFamily: null,
    fontFallback: null,
    fontSize: partial?.fontSize ?? null,
    fontWeight: partial?.fontWeight ?? null,
    lineHeight: partial?.lineHeight ?? null,
    fontStyle: null,
  };
}

function border(radius = 0, width = 0, color = '#000000') {
  return {
    borderStyle: 'solid',
    borderColor: color,
    borderWidthMode: 'uniform',
    borderTopWidth: width,
    borderRightWidth: width,
    borderBottomWidth: width,
    borderLeftWidth: width,
    borderRadiusMode: 'uniform',
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomRightRadius: radius,
    borderBottomLeftRadius: radius,
  };
}

export function spacer(height: number): JSONContent {
  return { type: 'spacer', attrs: { height, heightMode: 'uniform' } };
}

export function variable(id: string): JSONContent {
  return { type: 'variable', attrs: { id, label: id } };
}

export function text(
  value: string,
  marks?: JSONContent['marks'],
): JSONContent {
  return marks?.length ? { type: 'text', text: value, marks } : { type: 'text', text: value };
}

export function colored(value: string, color: string): JSONContent {
  return text(value, [{ type: 'textStyle', attrs: { color } }]);
}

export function paragraph(
  content: JSONContent[],
  textAlign: 'left' | 'center' | 'right' = 'left',
): JSONContent {
  return {
    type: 'paragraph',
    attrs: { textAlign, ...fontStyle() },
    content,
  };
}

export function heading(
  level: 1 | 2 | 3,
  value: string,
  color = BRAND.ink,
): JSONContent {
  const size = level === 1 ? 32 : level === 2 ? 22 : 18;
  return {
    type: 'heading',
    attrs: {
      level,
      textAlign: 'left',
      ...fontStyle({ fontSize: size, fontWeight: 600, lineHeight: 1.25 }),
    },
    content: [colored(value, color)],
  };
}

export function image(opts: {
  src: string;
  alt: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  href?: string | null;
  radius?: number;
}): JSONContent {
  return {
    type: 'image',
    attrs: {
      src: opts.src,
      alt: opts.alt,
      title: opts.alt,
      width: opts.width ?? '100%',
      align: opts.align ?? 'left',
      externalLink: opts.href ?? null,
      ...border(opts.radius ?? 0, 0),
    },
  };
}

export function button(label: string, url: string): JSONContent {
  return {
    type: 'button',
    attrs: {
      url,
      kind: 'tight',
      alignment: 'left',
      backgroundColor: BRAND.green,
      color: '#ffffff',
      paddingMode: 'mixed',
      paddingTop: 12,
      paddingRight: 28,
      paddingBottom: 12,
      paddingLeft: 28,
      ...border(RADIUS_PILL, 0, BRAND.green),
      ...fontStyle({ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }),
    },
    content: [text(label)],
  };
}

export function divider(): JSONContent {
  return { type: 'horizontalRule' };
}

export function bullets(items: string[]): JSONContent {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph([colored(item, BRAND.body)])],
    })),
  };
}

export function section(content: JSONContent[], backgroundColor = BRAND.wash): JSONContent {
  return {
    type: 'section',
    attrs: {
      backgroundColor,
      align: 'left',
      paddingMode: 'uniform',
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      marginMode: 'mixed',
      marginTop: 4,
      marginRight: 0,
      marginBottom: 16,
      marginLeft: 0,
      ...border(16, 0, '#E2E2E2'),
    },
    content,
  };
}

export function footerLine(parts: JSONContent[]): JSONContent {
  return {
    type: 'footer',
    attrs: { textAlign: 'left', ...fontStyle({ fontSize: 13, lineHeight: 1.6 }) },
    content: parts,
  };
}

export function linkMark(href: string) {
  return { type: 'link' as const, attrs: { href, target: '_blank' } };
}

export function doc(content: JSONContent[]): JSONContent {
  return { type: 'doc', content };
}
