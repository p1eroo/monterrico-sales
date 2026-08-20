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

export const PRESENTACION_SUBJECT =
  'Movilidad corporativa de confianza para {{empresa}}';

export const presentacionCorporativaDoc: JSONContent = doc([
  spacer(8),
  image({
    src: EMAIL_ASSETS.logo,
    alt: 'Taxi Monterrico',
    width: '42%',
    href: BRAND.site,
  }),
  spacer(28),
  heading(1, 'Movilidad corporativa de confianza'),
  spacer(8),
  paragraph([
    colored('Hola ', BRAND.body),
    variable('nombre'),
    colored(
      '. En Taxi Monterrico diseñamos el traslado de ejecutivos, equipos e invitados para empresas como ',
      BRAND.body,
    ),
    variable('empresa'),
    colored(
      ': puntualidad, unidades adecuadas y control de cada viaje.',
      BRAND.body,
    ),
  ]),
  spacer(16),
  button('Agendar una llamada', BRAND.site),
  spacer(24),
  image({
    src: EMAIL_ASSETS.ejecutivo,
    alt: 'Reunión corporativa — Taxi Monterrico',
    width: '100%',
    radius: 12,
  }),
  spacer(28),
  heading(2, 'Servicios que simplifican tu operación'),
  spacer(8),
  paragraph([
    colored(
      'Una sola cuenta para mover a tu equipo en Lima, con visibilidad y respaldo operativo.',
      BRAND.body,
    ),
  ]),
  spacer(12),
  section([
    bullets([
      'Transporte ejecutivo: puntualidad, seguridad y confort.',
      'Traslados al aeropuerto con cumplimiento de itinerarios.',
      'Eventos y grupos: vans, custer y buses a medida.',
    ]),
  ]),
  spacer(8),
  image({
    src: EMAIL_ASSETS.flotaVip,
    alt: 'Unidad VIP — Taxi Monterrico',
    width: '100%',
    radius: 12,
  }),
  spacer(20),
  divider(),
  spacer(12),
  footerLine([
    colored('Taxi Monterrico  ·  ', BRAND.muted),
    text(BRAND.phone, [linkMark(`tel:+5116115555`)]),
    colored('  ·  ', BRAND.muted),
    text(BRAND.email, [linkMark(`mailto:${BRAND.email}`)]),
  ]),
  footerLine([
    colored('Lima, Perú  ·  ', BRAND.muted),
    text('taximonterrico.com', [linkMark(BRAND.site)]),
  ]),
  spacer(8),
]);
