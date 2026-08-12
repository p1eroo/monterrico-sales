export type QuickReply = {
  id: string;
  label: string;
  text: string;
};

export const FLOTA_QUICK_REPLIES: QuickReply[] = [
  {
    id: 'saludo',
    label: 'Saludo inicial',
    text: 'Hola estimado(a), reciba un cordial saludo de parte de Taxi Monterrico. Queremos comunicarnos contigo para los servicios de tu zona. Responde este mensaje para continuar el proceso.',
  },
  {
    id: 'info-flota',
    label: 'Información flota',
    text: 'Hemos observado su interés en formar parte de nuestra flota. ¿Usted cuenta con vehículo particular o tiene permiso de la ATU? ¿De qué año es su vehículo?',
  },
  {
    id: 'seguimiento',
    label: 'Seguimiento',
    text: 'Buen día, le escribimos para dar seguimiento a su solicitud. ¿Podría confirmarnos si sigue interesado(a)?',
  },
  {
    id: 'cita',
    label: 'Agendar cita',
    text: 'Perfecto, podemos agendar una cita para continuar el proceso. ¿Qué día y horario le resulta conveniente?',
  },
];
