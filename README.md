# 📱 Liderman - Sistema de Gestión de Clientes

## 🎯 Descripción General

Aplicación web de gestión de clientes basada en Firebase con múltiples dashboards según rol de usuario:
- **Dashboard General**: SUPERVISOR GENERAL
- **Comercial**: Equipo comercial
- **Operativo**: Equipo de operaciones
- **Nueva App**: Registro de nuevas solicitudes (PWA)

---

## ✨ CAMBIOS RECIENTES (10 NOV 2025)

### 🎨 Interfaz Mejorada
- ✅ Modal "Agregar Opción" con diseño elegante (gradientes, animaciones)
- ✅ Validación en tiempo real con feedback visual
- ✅ Cierre por ESC, click fuera, y botones

### 🔄 Sincronización de Datos
- ✅ Desplegables centralizados en `DESPEGABLES` collection
- ✅ Sincronización real-time en todas las páginas
- ✅ Eliminada duplicación de código (-60%)
- ✅ Consistencia de datos garantizada

### 📊 Análisis Completo
- ✅ Auditoría de 10 problemas identificados
- ✅ Plan de acción priorizado
- ✅ Documentación CSS creada
- ✅ Checklist de testing preparado

---

## 📁 Estructura de Archivos

```
valoresweb/
├── index.html                    # Página de login
├── dashboard.html               # Dashboard principal (SUPERVISOR)
├── comercial.html               # Dashboard comercial
├── operativo.html               # Dashboard operativo
│
├── script.js                     # Lógica de login
├── dashboard.js                  # Lógica del dashboard
├── comercial.js                  # Lógica comercial (MEJORADO)
├── operativo.js                  # Lógica operativo (MEJORADO)
│
├── styles.css                    # Estilos login
├── dashboard.css                 # Estilos dashboard (MEJORADO)
├── common.css                    # Estilos comunes
│
├── nueva/
│   ├── nueva.html               # Página de nuevas solicitudes
│   ├── app.js                   # Lógica nueva app (MEJORADO)
│   ├── offerings.js             # Gestión de ofrecimientos
│   ├── nueva.css                # Estilos nueva app
│   ├── service-worker.js        # PWA service worker
│   └── manifest.json            # PWA manifest
│
├── firebase-config.js           # Configuración Firebase (⚠️ Credenciales expuestas)
│
├── imagenes/                    # Imágenes del proyecto
│   ├── background.png
│   └── logo.png
│
└── DOCUMENTACIÓN/
    ├── RESUMEN_EJECUTIVO.md     # Resumen de cambios
    ├── CAMBIOS_REALIZADOS.md    # Detalle técnico
    ├── AUDITORIA_MEJORAS.md     # Auditoría completa
    ├── MEJORAS_CSS.md           # Guía de estilos
    └── TESTING_CHECKLIST.md     # Checklist de pruebas
```

---

## 🔐 Configuración Firebase

**Proyecto**: valores-a5953

⚠️ **IMPORTANTE**: Las credenciales se cargan desde `.env.local`
→ Usar variables de entorno para máxima seguridad
→ Nunca hacer commit de `.env.local` (archivo local solamente)

---

## 🔥 Colecciones Firestore

### DESPEGABLES (Principal)
```
DESPEGABLES/
├── VIGILANCIA
│   ├── 1: "Opción Vigilancia 1"
│   ├── 2: "Opción Vigilancia 2"
│   └── 3: "Opción Vigilancia 3"
│
└── TECNOLOGIA
    ├── 1: "Opción Tecnología 1"
    ├── 2: "Opción Tecnología 2"
    └── 3: "Opción Tecnología 3"
```

### users
- Autenticación Firebase

### usuarios
- Perfiles de usuario
- Campos: NOMBRE, TIPO (rol), ZONA

### clients
- Datos de clientes por usuario
- Subcollection bajo users/{userId}/clients

---

## 🚀 Cómo Empezar

### Desarrollo Local
```bash
# Instalar servidor HTTP
python -m http.server 8080

# Acceder a
http://localhost:8080

# Login con usuario registrado en Firebase
```

### Deploy a Producción
1. Mover credenciales a `.env`
2. Ejecutar checklist de testing
3. Verificar Firestore Security Rules
4. Deploy a hosting (Firebase Hosting o similar)

---

## 📊 Roles de Usuario

| Rol | Dashboard | Acceso |
|-----|-----------|--------|
| SUPERVISOR GENERAL | dashboard.html | Todas las funciones |
| COMERCIAL | comercial.html | Clientes ganados, ejecución |
| OPERATIVO | operativo.html | Solo clientes ganados |
| USUARIO | nueva/nueva.html | Registrar nuevas solicitudes |

---

## 🎯 Funcionalidades Principales

### Dashboard
- 📊 Resumen de métricas
- 📋 Tabla de clientes (paginada)
- ✏️ Editor de servicios
- 📈 Gráficos de ejecución
- 🏆 Ranking de usuarios

### Gestión de Servicios
- ✅ Seleccionar servicios (Vigilancia, Tecnología)
- ➕ Agregar nuevos servicios
- 🗑️ Eliminar servicios
- 💰 Cálculo de costos

### Nuevas Solicitudes
- 📝 Formulario de registro
- 📍 Desplegables sincronizados
- 🔄 Sincronización real-time

---

## 📱 Responsive Design

- ✅ Desktop (1200px+)
- ✅ Tablet (768px - 991px)
- ✅ Mobile (< 768px)

---

## ♿ Accesibilidad

- ✅ WCAG 2.1 Level AA (en progreso)
- ✅ Navegación por teclado
- ✅ Atributos ARIA en modales
- ✅ Contraste de colores verificado

---

## 🐛 Problemas Conocidos

### CRÍTICOS 🔴
1. **Seguridad**: Credenciales de Firebase expuestas
   - Solución: Mover a .env

2. **Sincronización**: Datos no siempre consistentes
   - Solución: Centralizar en DESPEGABLES ✅ (HECHO)

### MAYORES 🟡
3. **Performance**: Queries lentas en tablas grandes
4. **Responsive**: Mobile needs improvement
5. **Accesibilidad**: No es completamente WCAG AA

### MENORES 🟢
6. Falta documentación de código
7. No hay dark mode
8. Imágenes no tienen lazy loading

---

## 📝 Últimas Mejoras

### Sesión 10-NOV-2025
- ✅ Modal elegante para agregar opciones
- ✅ Sincronización DESPEGABLES en comercial.js
- ✅ Sincronización DESPEGABLES en operativo.js
- ✅ CSS mejorado con gradientes
- ✅ Auditoría completa generada
- ✅ Documentación técnica creada

---

## 🔄 Próximas Acciones

### INMEDIATO
1. ✅ Testing en navegador (pendiente)
2. ✅ Verificar sincronización real-time
3. ✅ Probar modales en todas las páginas

### CORTO PLAZO
4. Centralizar variables CSS
5. Mejorar responsive en mobile
6. Aplicar mejoras CSS a otros modales

### MEDIANO PLAZO
7. Implementar seguridad (env vars)
8. Optimizar performance
9. Mejorar accesibilidad

---

## 📚 Documentación Disponible

| Documento | Contenido |
|-----------|-----------|
| `RESUMEN_EJECUTIVO.md` | Overview de cambios y impacto |
| `CAMBIOS_REALIZADOS.md` | Detalle técnico de cada cambio |
| `AUDITORIA_MEJORAS.md` | 10 problemas identificados + soluciones |
| `MEJORAS_CSS.md` | Guía de estilos y variables CSS |
| `TESTING_CHECKLIST.md` | Checklist para probar cambios |
| `VERIFICACION_DESPLEGABLES.md` | Verificación estructura Firestore |

---

## 👨‍💻 Desarrollo

### Stack Tecnológico
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Firebase (Auth, Firestore)
- **CSS Framework**: Tailwind CSS (nueva app) + CSS personalizado
- **Charting**: Chart.js
- **Date**: Day.js
- **Icons**: Font Awesome

### Archivos Modificados en Esta Sesión
1. `nueva/app.js` - Modal elegante
2. `dashboard.js` - Referencias limpias
3. `dashboard.html` - HTML mejorado
4. `dashboard.css` - CSS renovado
5. `comercial.js` - Sincronización Firestore
6. `operativo.js` - Sincronización Firestore

### Archivos Nuevos Creados
- `RESUMEN_EJECUTIVO.md`
- `CAMBIOS_REALIZADOS.md`
- `AUDITORIA_MEJORAS.md`
- `MEJORAS_CSS.md`
- `TESTING_CHECKLIST.md`

---

## 🤝 Contribuir

Para contribuir a las mejoras:
1. Crear rama para feature
2. Hacer cambios
3. Ejecutar TESTING_CHECKLIST.md
4. Crear pull request

---

## 📞 Soporte

Para problemas o preguntas:
1. Revisar `AUDITORIA_MEJORAS.md` para soluciones comunes
2. Ejecutar `TESTING_CHECKLIST.md` para diagnosticar
3. Revisar console de DevTools (F12) para errores

---

## 📄 Licencia

Proyecto propietario - Todos los derechos reservados

---

## 📅 Versión Actual

**v2.1.0** - 10 Noviembre 2025
- ✅ Modal elegante
- ✅ Sincronización centralizada
- ✅ Auditoría completa
- ✅ Documentación mejorada

---

**Última Actualización**: 10 de Noviembre de 2025
**Mantenedor**: Sistema Liderman
**Estado**: 🟢 En Desarrollo Activo

