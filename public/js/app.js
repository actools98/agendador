document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========== ESTADO ==========
  let currentDate = new Date();
  let currentView = 'month';
  let events = [];
  let finishedEvents = [];

  // Variables que se cargarán desde el backend
  let timeFormat = '24';
  let workStart = 8;
  let workEnd = 17;
  let tema = 'claro';

  // ========== ELEMENTOS DOM ==========
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const grid = $('#calendarGrid');
  const viewTitle = $('#viewTitle');
  const prevBtn = $('#prevView');
  const nextBtn = $('#nextView');
  const viewBtns = $$('.view-btn');
  const newEventBtn = $('#newEventBtn');
  const settingsBtn = $('#settingsBtn');
  const toggleFinishedBtn = $('#toggleFinishedBtn');
  const eventListEl = $('#eventList');
  const finishedListEl = $('#finishedEventsList');

  const settingsModal = new bootstrap.Modal($('#settingsModal'));
  const timeFormatSelect = $('#timeFormatSelect');
  const themeSelect = $('#themeSelect');
  const workStartInput = $('#workStart');
  const workEndInput = $('#workEnd');
  const saveSettingsBtn = $('#saveSettingsBtn');

  const modalEvent = new bootstrap.Modal($('#eventModal'));
  const modalTitle = $('#modalTitle');
  const form = $('#eventForm');
  const eventIdInput = $('#eventId');
  const titleInput = $('#title');
  const descriptionInput = $('#description');
  const startInput = $('#start');
  const endInput = $('#end');
  const allDayInput = $('#allDay');
  const colorInput = $('#color');
  const statusSelect = $('#eventStatus');
  const saveBtn = $('#saveEventBtn');
  const deleteBtn = $('#deleteEventBtn');

  let currentEventId = null;
  let finishedVisible = false;

  // ========== FUNCIONES DE FORMATO DE HORA ==========
  function formatTime(date, format = timeFormat) {
    if (format === '12') {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function formatTimeRange(start, end) {
    return `${formatTime(start)} - ${formatTime(end)}`;
  }

  // ========== APLICAR TEMA ==========
  function applyTheme(theme) {
    if (theme === 'oscuro') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  }

  // ========== CARGAR PREFERENCIAS ==========
  async function loadPreferences() {
    try {
      const res = await fetch('/api/preferencias');
      if (!res.ok) throw new Error('Error al cargar preferencias');
      const data = await res.json();
      // Asignar valores
      timeFormat = data.formato_hora || '24';
      workStart = data.work_start || 8;
      workEnd = data.work_end || 17;
      tema = data.tema || 'claro';
      // Aplicar tema
      applyTheme(tema);
      // Actualizar los selects en el modal de configuración (si está abierto, se sincronizará al abrir)
    } catch (error) {
      console.error('Error cargando preferencias:', error);
      // Valores por defecto
      timeFormat = '24';
      workStart = 8;
      workEnd = 17;
      tema = 'claro';
      applyTheme('claro');
    }
  }

  // ========== GUARDAR PREFERENCIAS ==========
  async function savePreferences() {
    const payload = {
      tema: themeSelect.value,
      formato_hora: timeFormatSelect.value,
      work_start: parseInt(workStartInput.value) || 8,
      work_end: parseInt(workEndInput.value) || 17
    };

    // Validar que work_start < work_end
    if (payload.work_start >= payload.work_end) {
      alert('La hora de inicio debe ser anterior a la hora de fin.');
      return;
    }

    try {
      const res = await fetch('/api/preferencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // Recargar la página para aplicar todos los cambios
        window.location.reload();
      } else {
        const err = await res.json();
        alert('Error al guardar: ' + (err.error || 'desconocido'));
      }
    } catch (error) {
      console.error('Error guardando preferencias:', error);
      alert('Error al guardar preferencias');
    }
  }

  // ========== CARGAR EVENTOS ==========
  async function loadEventsFromServer() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Error al cargar eventos');
      const allEvents = await res.json();
      events = allEvents.filter(e => !e.status || e.status === 'active');
      finishedEvents = allEvents.filter(e => e.status && e.status !== 'active');
      renderView();
      renderEventList();
      renderFinishedList();
    } catch (error) {
      console.error('Error cargando eventos:', error);
    }
  }

  // ========== RENDER LISTAS ==========
  function renderEventList() {
    // ... (mismo código que antes, sin cambios)
  }

  function renderFinishedList() {
    // ... (mismo código que antes, sin cambios)
  }

  // ========== RENDER VISTAS ==========
  function renderView() {
    switch (currentView) {
      case 'day':   renderDayView(); break;
      case 'week':  renderWeekView(); break;
      case 'month': renderMonthView(); break;
      case 'year':  renderYearView(); break;
      default: renderMonthView();
    }
    focusWorkHours();
  }

  // ========== ENFOQUE LABORAL ==========
  function focusWorkHours() {
    if (currentView !== 'day' && currentView !== 'week') return;
    requestAnimationFrame(() => {
      const container = currentView === 'day'
        ? document.querySelector('.day-time-grid')
        : document.querySelector('.week-body-wrapper');
      if (!container) return;
      const selector = currentView === 'day'
        ? `.day-hour-label[data-hour="${workStart}"]`
        : `.week-hour-label[data-hour="${workStart}"]`;
      const target = container.querySelector(selector);
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        container.scrollTop = targetRect.top - containerRect.top;
      }
    });
  }

  // ========== VISTAS (day, week, month, year) ==========
  // ... (todas las funciones de renderizado son iguales que antes, usando las variables timeFormat, workStart, workEnd)

  // ========== MODAL CREAR/EDITAR ==========
  // ... (sin cambios)

  // ========== NAVEGACIÓN ==========
  // ... (sin cambios)

  // ========== EVENT LISTENERS ==========
  // ... (sin cambios, excepto los que gestionaban configuración)

  // Configuración: abrir modal y cargar valores actuales
  settingsBtn.addEventListener('click', function() {
    timeFormatSelect.value = timeFormat;
    themeSelect.value = tema;
    workStartInput.value = workStart;
    workEndInput.value = workEnd;
    settingsModal.show();
  });

  // Botón Guardar cambios
  saveSettingsBtn.addEventListener('click', savePreferences);

  // Botones de evento, prev/next, etc. (sin cambios)

  // ========== INICIO ==========
  // Primero cargar preferencias, luego eventos
  loadPreferences().then(() => {
    loadEventsFromServer();
  });
});
