/**
 * Centralized offerings list and categories.
 * Exposes on window.OFFERINGS for non-module scripts.
 */
(function(){
  const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
  const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';

  const availableOfferings = [
    { name: 'Plan de Responsabilidad Social', category: VIGILANCIA_CATEGORY },
    { name: 'Estudio de seguridad con optimización de tecnología', category: VIGILANCIA_CATEGORY },
    { name: 'Reportes con Power BI', category: VIGILANCIA_CATEGORY },
    { name: 'Software de control de Riegos (Total Risik)', category: VIGILANCIA_CATEGORY },
    { name: 'Asistente Administrativo', category: VIGILANCIA_CATEGORY },
    { name: 'Supervisión área con dron', category: VIGILANCIA_CATEGORY },
    { name: 'Administrador de contrato', category: VIGILANCIA_CATEGORY },
    { name: 'Celebración de festividades', category: VIGILANCIA_CATEGORY },
    { name: 'Equipos de computo', category: VIGILANCIA_CATEGORY },
    { name: 'Implementación de consola de seguridad', category: VIGILANCIA_CATEGORY },
    { name: 'Chatbot para atención a incidentes', category: VIGILANCIA_CATEGORY },
    { name: 'Monitoreo con analítica de video', category: TECNOLOGIA_CATEGORY },
    { name: 'Control de acceso biométrico', category: TECNOLOGIA_CATEGORY },
    { name: 'Cámaras IP con IA', category: TECNOLOGIA_CATEGORY },
    { name: 'Cerco perimétrico inteligente', category: TECNOLOGIA_CATEGORY },
    { name: 'Botón de pánico con geolocalización', category: TECNOLOGIA_CATEGORY }
  ];

  window.OFFERINGS = { VIGILANCIA_CATEGORY, TECNOLOGIA_CATEGORY, availableOfferings };
})();
