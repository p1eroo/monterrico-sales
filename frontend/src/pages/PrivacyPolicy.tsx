export default function PrivacyPolicy() {
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-4xl px-4 pt-0 pb-8 sm:px-6 lg:px-8">
        <div>
          <img src="/logo_tm.png" alt="" className="block size-36 rounded-xl object-contain" />
          <h1 className="-mt-8 text-2xl font-semibold text-gray-900 dark:text-white">Política de Privacidad</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">TaxiMonterrico S.A.C.</p>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-12">
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">Última actualización: 17 de junio de 2026</p>

          <section className="mt-8 space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">1. Responsable del tratamiento</h2>
              <p>
                TaxiMonterrico S.A.C. (en adelante, "TaxiMonterrico", "nosotros" o "nos"), con domicilio en Lima, Perú,
                es el responsable del tratamiento de los datos personales recabados a través de nuestra plataforma CRM
                (Customer Relationship Management) disponible en <strong>crm.taximonterrico.com</strong>.
              </p>
              <p className="mt-2">
                Para cualquier consulta relacionada con esta política, puedes contactarnos a través de:
                <br />
                Correo electrónico: <a href="mailto:privacidad@taximonterrico.pe" className="text-[#13944C] underline">privacidad@taximonterrico.pe</a>
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">2. Datos que recolectamos</h2>
              <p>A través de nuestra integración con Facebook Lead Ads, recolectamos la siguiente información proporcionada voluntariamente por los usuarios al completar formularios de contacto:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Nombre completo</li>
                <li>Número de teléfono / celular</li>
                <li>Dirección de correo electrónico</li>
                <li>Nombre de empresa o negocio</li>
                <li>Número de RUC o documento de identidad</li>
                <li>Distrito o ubicación geográfica</li>
                <li>Cualquier otro dato incluido en los formularios personalizados de Facebook Lead Ads</li>
              </ul>
              <p className="mt-2">
                No recolectamos datos sensibles como origen racial, opiniones políticas, creencias religiosas, afiliación sindical, datos biométricos o de salud.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">3. Finalidad del tratamiento</h2>
              <p>Los datos personales recolectados son utilizados exclusivamente para:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li><strong>Gestión comercial:</strong> registrar y dar seguimiento a prospectos y clientes interesados en los servicios de TaxiMonterrico.</li>
                <li><strong>Contacto:</strong> comunicarnos con los usuarios para brindar información sobre nuestros servicios.</li>
                <li><strong>Distribución interna:</strong> asignar los leads a los equipos comerciales o de flota según corresponda.</li>
                <li><strong>Mejora del servicio:</strong> analizar datos agregados para optimizar nuestras campañas de marketing y atención al cliente.</li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">4. Base legal</h2>
              <p>
                El tratamiento de sus datos personales se realiza sobre la base del consentimiento otorgado al completar
                voluntariamente los formularios de Facebook Lead Ads. Al enviar sus datos a través de dichos formularios,
                el usuario acepta que estos sean transferidos y tratados en nuestra plataforma CRM para los fines descritos
                en esta política.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">5. Compartición de datos</h2>
              <p>
                TaxiMonterrico no comparte, vende, alquila ni cede datos personales a terceros no vinculados. Los datos
                son accesibles únicamente por:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Personal autorizado de TaxiMonterrico (asesores comerciales, supervisores, administradores).</li>
                <li>Meta Platforms Inc. (Facebook), como origen de los datos, bajo los términos de su propia política de privacidad.</li>
                <li>Proveedores de infraestructura tecnológica (hosting, base de datos) que actúan como encargados del tratamiento bajo contrato de confidencialidad.</li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">6. Plazo de conservación</h2>
              <p>
                Conservaremos sus datos personales mientras su cuenta de lead o cliente esté activa en nuestro CRM.
                Una vez que se determine que ya no es necesario para los fines descritos, los datos serán eliminados
                o anonimizados en un plazo máximo de 12 meses.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">7. Derechos del titular</h2>
              <p>De conformidad con la Ley N° 29733 (Ley de Protección de Datos Personales del Perú), usted tiene derecho a:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li><strong>Acceder</strong> a sus datos personales almacenados en nuestro CRM.</li>
                <li><strong>Rectificar</strong> datos inexactos o incompletos.</li>
                <li><strong>Cancelar</strong> (suprimir) sus datos cuando ya no sean necesarios.</li>
                <li><strong>Oponerse</strong> al tratamiento de sus datos para fines específicos.</li>
              </ul>
              <p className="mt-2">
                Para ejercer estos derechos, envía un correo a{' '}
                <a href="mailto:privacidad@taximonterrico.pe" className="text-[#13944C] underline">privacidad@taximonterrico.pe</a>
                {' '}indicando el derecho que deseas ejercer y tus datos de identificación. Responderemos en un plazo máximo de 15 días hábiles.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">8. Seguridad de los datos</h2>
              <p>
                Implementamos medidas de seguridad técnicas y organizativas adecuadas para proteger sus datos contra
                acceso no autorizado, pérdida, destrucción o alteración. Esto incluye: encriptación en tránsito (TLS),
                almacenamiento en bases de datos seguras, control de acceso basado en roles, y auditoría periódica de accesos.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">9. Integración con Facebook</h2>
              <p>
                Nuestra plataforma utiliza la API de Facebook Lead Ads para recibir datos de formularios de contacto.
                La recolección inicial de datos se realiza a través de los formularios de Facebook y está sujeta a las
                políticas de privacidad de Meta Platforms Inc. Recomendamos revisar la{' '}
                <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer" className="text-[#13944C] underline">
                  Política de Privacidad de Facebook
                </a>
                {' '}para más información sobre cómo Facebook maneja sus datos.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">10. Cambios a esta política</h2>
              <p>
                Nos reservamos el derecho de actualizar esta política de privacidad en cualquier momento. Los cambios serán
                notificados a través de nuestra plataforma CRM y, cuando sea posible, mediante correo electrónico. La fecha
                de la última actualización aparece al inicio de este documento.
              </p>
            </div>
          </section>

          <div className="mt-10 border-t border-gray-200 pt-6 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              TaxiMonterrico S.A.C. · Lima, Perú · RUC: 20603805031
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
