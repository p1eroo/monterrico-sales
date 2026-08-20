import type { JSONContent } from '@tiptap/core';
import { BRAND, EMAIL_ASSETS } from '../brand';
import {
  bullets,
  button,
  colored,
  divider,
  doc,
  footerLine,
  heading,
  image,
  linkMark,
  paragraph,
  section,
  spacer,
  text,
  variable,
} from '../nodes';

export const AEROPUERTO_SUBJECT =
  'Traslados al aeropuerto para {{empresa}}, sin imprevistos';

export const aeropuertoEjecutivoDoc: JSONContent = doc([
  spacer(8),
  image({
    src: EMAIL_ASSETS.logo,
    alt: 'Taxi Monterrico',
    width: '42%',
    href: BRAND.site,
  }),
  spacer(28),
  heading(1, 'Traslados al aeropuerto, sin imprevistos'),
  spacer(8),
  paragraph([
    colored('Hola ', BRAND.body),
    variable('nombre'),
    colored(
      '. Cuando un ejecutivo o un invitado de ',
      BRAND.body,
    ),
    variable('empresa'),
    colored(
      ' vuela, el traslado también es parte de la experiencia: pickup a tiempo, seguimiento y una unidad acorde al viaje.',
      BRAND.body,
    ),
  ]),
  spacer(16),
  button('Coordinar un traslado', BRAND.site),
  spacer(24),
  image({
    src: EMAIL_ASSETS.aeropuerto,
    alt: 'Traslados al aeropuerto — Taxi Monterrico',
    width: '100%',
    radius: 12,
  }),
  spacer(28),
  heading(2, 'Llegadas y salidas bajo control'),
  spacer(8),
  paragraph([
    colored(
      'Coordinamos horarios, esperas y cambios de vuelo para que tu equipo no improvise en Jorge Chávez.',
      BRAND.body,
    ),
  ]),
  spacer(12),
  section([
    bullets([
      'Pickup y drop-off alineados al itinerario.',
      'Unidades Standard, VIP, Elite o van según el grupo.',
      'Seguimiento en tiempo real desde la app y la intranet.',
    ]),
  ]),
  spacer(8),
  divider(),
  spacer(12),
  footerLine([
    colored('¿Necesitas ayuda?  ', BRAND.muted),
    text(BRAND.phone, [linkMark('tel:+5116115555')]),
    colored('  ·  ', BRAND.muted),
    text(BRAND.email, [linkMark(`mailto:${BRAND.email}`)]),
  ]),
  footerLine([
    colored('Taxi Monterrico  ·  Lima  ·  ', BRAND.muted),
    text('taximonterrico.com', [linkMark(BRAND.site)]),
  ]),
  spacer(8),
]);
