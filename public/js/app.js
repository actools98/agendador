document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========== ESTADO ==========
  let currentDate = new Date();
  let currentView = 'month';
  let events = [];
  let finishedEvents = [];

  let timeFormat = '24';
  let tema = 'claro';

  // Altura fija por hora (en píxeles)
  const HOUR_HEIGHT = 70;

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
      timeFormat = data.formato_hora || '24';
      tema = data.tema || 'claro';
      applyTheme(tema);
    } catch (error) {
      console.error('Error cargando preferencias:', error);
      timeFormat = '24';
      tema = 'claro';
      applyTheme('claro');
    }
  }

  // ========== GUARDAR PREFERENCIAS ==========
  async function savePreferences() {
    const payload = {
      tema: themeSelect.value,
      formato_hora: timeFormatSelect.value
    };

    try {
      const res = await fetch('/api/preferencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
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

  // ========== RENDER LISTA DE EVENTOS ACTIVOS ==========
  function renderEventList() {
    if (!eventListEl) return;
    if (events.length === 0) {
      eventListEl.innerHTML = '<div class="text-muted small p-2">No hay eventos activos</div>';
      return;
    }
    const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
    let html = '';
    sorted.forEach(ev => {
      const startDate = new Date(ev.start);
      const dateStr = startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      const timeStr = formatTime(startDate);
      html += `
        <div class="list-group-item" data-id="${ev.id}">
          <span class="event-title" style="border-left: 4px solid ${ev.color || '#3788d8'}; padding-left: 8px;" title="${ev.title} - ${timeStr}">
            <strong>${ev.title}</strong><br>
            <small class="text-muted">${dateStr} ${timeStr}</small>
          </span>
          <span class="event-actions">
            <button class="edit-event" data-id="${ev.id}" title="Editar">✏️</button>
            <button class="delete-event" data-id="${ev.id}" title="Eliminar">🗑️</button>
          </span>
        </div>
      `;
    });
    eventListEl.innerHTML = html;

    $$('.edit-event', eventListEl).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openEditModal(parseInt(btn.dataset.id));
      });
    });
    $$('.delete-event', eventListEl).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('¿Eliminar este evento?')) deleteEvent(parseInt(btn.dataset.id));
      });
    });
    $$('.event-title', eventListEl).forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.closest('.list-group-item').dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== RENDER LISTA DE EVENTOS TERMINADOS ==========
  function renderFinishedList() {
    if (!finishedListEl) return;
    if (finishedEvents.length === 0) {
      finishedListEl.innerHTML = '<div class="text-muted small p-2">No hay eventos terminados</div>';
      return;
    }
    const sorted = [...finishedEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
    let html = '';
    sorted.forEach(ev => {
      const startDate = new Date(ev.start);
      const dateStr = startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      const timeStr = formatTime(startDate);
      const statusLabel = {
        'completed': '✅ Completado',
        'postponed': '⏳ Pospuesto',
        'cancelled': '❌ Cancelado'
      }[ev.status] || ev.status;
      html += `
        <div class="list-group-item" data-id="${ev.id}" style="opacity:0.7;">
          <span class="event-title" style="border-left: 4px solid ${ev.color || '#3788d8'}; padding-left: 8px;" title="${ev.title} - ${timeStr}">
            <strong>${ev.title}</strong><br>
            <small class="text-muted">${dateStr} ${timeStr} - ${statusLabel}</small>
          </span>
          <span class="event-actions">
            <button class="edit-event-finished" data-id="${ev.id}" title="Editar">✏️</button>
            <button class="delete-event-finished" data-id="${ev.id}" title="Eliminar">🗑️</button>
          </span>
        </div>
      `;
    });
    finishedListEl.innerHTML = html;

    $$('.edit-event-finished', finishedListEl).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openEditModal(parseInt(btn.dataset.id));
      });
    });
    $$('.delete-event-finished', finishedListEl).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('¿Eliminar este evento?')) deleteEvent(parseInt(btn.dataset.id));
      });
    });
    $$('.event-title', finishedListEl).forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.closest('.list-group-item').dataset.id);
        openEditModal(id);
      });
    });
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
    if (currentView === 'day' || currentView === 'week') {
      startRedLineUpdater();
    } else {
      stopRedLineUpdater();
    }
  }

  // ========== ACTUALIZAR LÍNEA ROJA ==========
  let redLineInterval = null;

  function startRedLineUpdater() {
    if (redLineInterval) return;
    redLineInterval = setInterval(() => {
      updateRedLine();
    }, 60000);
  }

  function stopRedLineUpdater() {
    if (redLineInterval) {
      clearInterval(redLineInterval);
      redLineInterval = null;
    }
  }

  function updateRedLine() {
    const lines = document.querySelectorAll('.current-time-line');
    if (lines.length === 0) return;
    const now = new Date();
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const totalMinutes = 24 * 60;
    const topPercent = (minutesSinceMidnight / totalMinutes) * 100;
    lines.forEach(line => {
      line.style.top = `${Math.min(100, topPercent)}%`;
    });
  }

  // ========== VISTA DÍA ==========
  function renderDayView() {
    // ... (código existente, sin cambios)
  }

  // ========== VISTA SEMANA ==========
  function renderWeekView() {
    // ... (código existente, sin cambios)
  }

  // ========== VISTA MES ==========
  function renderMonthView() {
    // ... (código existente, sin cambios)
  }

  // ========== VISTA AÑO ==========
  function renderYearView() {
    // ... (código existente, sin cambios)
  }

  // ========== MODAL: CREAR / EDITAR ==========
  function openCreateModal(dateStr, hour) {
    // ... (código existente, sin cambios)
  }

  async function openEditModal(id) {
    // ... (código existente, sin cambios)
  }

  async function saveEvent() {
    // ... (código existente, sin cambios)
  }

  async function deleteEvent(id) {
    // ... (código existente, sin cambios)
  }

  // ========== NAVEGACIÓN ==========
  function prev() {
    // ... (código existente, sin cambios)
  }

  function next() {
    // ... (código existente, sin cambios)
  }

  function updateViewButtons() {
    // ... (código existente, sin cambios)
  }

  function setView(view) {
    // ... (código existente, sin cambios)
  }

  // ========== EVENT LISTENERS ==========
  // ... (código existente, sin cambios, pero eliminando los de workStart y workEnd)

  // En el evento de apertura de settings, ya no se cargan workStart ni workEnd
  settingsBtn.addEventListener('click', function() {
    timeFormatSelect.value = timeFormat;
    themeSelect.value = tema;
    settingsModal.show();
  });

  // El resto de listeners (guardar, etc.) se mantienen

  // ========== INICIO ==========
  loadPreferences().then(() => {
    loadEventsFromServer();
  });
});
