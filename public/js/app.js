document.addEventListener('DOMContentLoaded', function() {
  // ========== ESTADO ==========
  let currentDate = new Date();
  let currentView = 'month';
  let events = [];
  let finishedEvents = [];

  let timeFormat = localStorage.getItem('calendar_time_format') || '24';
  let workStart = parseInt(localStorage.getItem('work_start')) || 8;
  let workEnd = parseInt(localStorage.getItem('work_end')) || 17;

  // ========== ELEMENTOS DOM ==========
  const grid = document.getElementById('calendarGrid');
  const viewTitle = document.getElementById('viewTitle');
  const prevBtn = document.getElementById('prevView');
  const nextBtn = document.getElementById('nextView');
  const viewBtns = document.querySelectorAll('.view-btn');
  const newEventBtn = document.getElementById('newEventBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const toggleFinishedBtn = document.getElementById('toggleFinishedBtn');
  const eventListEl = document.getElementById('eventList');
  const finishedListEl = document.getElementById('finishedEventsList');

  const settingsModalElement = document.getElementById('settingsModal');
  const settingsModal = new bootstrap.Modal(settingsModalElement);
  const timeFormatSelect = document.getElementById('timeFormatSelect');
  const workStartInput = document.getElementById('workStart');
  const workEndInput = document.getElementById('workEnd');

  const modalElement = document.getElementById('eventModal');
  const modal = new bootstrap.Modal(modalElement);
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('eventForm');
  const eventIdInput = document.getElementById('eventId');
  const titleInput = document.getElementById('title');
  const descriptionInput = document.getElementById('description');
  const startInput = document.getElementById('start');
  const endInput = document.getElementById('end');
  const allDayInput = document.getElementById('allDay');
  const colorInput = document.getElementById('color');
  const statusSelect = document.getElementById('eventStatus');
  const saveBtn = document.getElementById('saveEventBtn');
  const deleteBtn = document.getElementById('deleteEventBtn');

  let currentEventId = null;
  let finishedVisible = false;

  // ========== FUNCIONES DE FORMATO DE HORA ==========
  function formatTime(date, format = timeFormat) {
    if (format === '12') {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    } else {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
  }

  function formatTimeRange(start, end, format = timeFormat) {
    if (format === '12') {
      return `${formatTime(start, '12')} - ${formatTime(end, '12')}`;
    } else {
      return `${formatTime(start, '24')} - ${formatTime(end, '24')}`;
    }
  }

  // ========== GUARDAR CONFIGURACIÓN ==========
  function setTimeFormat(format) {
    timeFormat = format;
    localStorage.setItem('calendar_time_format', format);
    if (timeFormatSelect) timeFormatSelect.value = format;
    renderView();
    renderEventList();
    renderFinishedList();
  }

  function setWorkHours(start, end) {
    workStart = start;
    workEnd = end;
    localStorage.setItem('work_start', start);
    localStorage.setItem('work_end', end);
    // Actualizar los inputs del modal
    if (workStartInput) workStartInput.value = start;
    if (workEndInput) workEndInput.value = end;
    // Si estamos en vista día o semana, volver a renderizar y enfocar
    if (currentView === 'day' || currentView === 'week') {
      renderView();
      setTimeout(focusWorkHours, 100);
    }
  }

  // ========== ENFOQUE EN FRANJA LABORAL ==========
  function focusWorkHours() {
    // Buscar el contenedor con scroll
    let container;
    if (currentView === 'day') {
      container = document.querySelector('.day-time-grid');
    } else if (currentView === 'week') {
      container = document.querySelector('.week-body-wrapper');
    } else {
      return;
    }
    if (!container) return;

    // Buscar el elemento que corresponde a la hora de inicio
    let targetElement;
    if (currentView === 'day') {
      targetElement = container.querySelector(`.day-hour-label[data-hour="${workStart}"]`);
    } else if (currentView === 'week') {
      targetElement = container.querySelector(`.week-hour-label[data-hour="${workStart}"]`);
    }
    if (!targetElement) {
      // Si no hay etiqueta, buscar el slot
      if (currentView === 'day') {
        targetElement = container.querySelector(`.day-hour-slot[data-hour="${workStart}"]`);
      } else {
        targetElement = container.querySelector(`.week-hour-slot[data-hour="${workStart}"]`);
      }
    }
    if (targetElement) {
      // Desplazar el contenedor para que la hora de inicio quede arriba
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const offset = targetRect.top - containerRect.top;
      container.scrollTop = offset;
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

  // ========== RENDERIZAR LISTA DE EVENTOS ACTIVOS ==========
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

    document.querySelectorAll('.edit-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        openEditModal(id);
      });
    });
    document.querySelectorAll('.delete-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (confirm('¿Eliminar este evento?')) {
          deleteEvent(id);
        }
      });
    });
    document.querySelectorAll('.event-title').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.closest('.list-group-item').dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== RENDERIZAR LISTA DE EVENTOS TERMINADOS ==========
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

    document.querySelectorAll('.edit-event-finished').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        openEditModal(id);
      });
    });
    document.querySelectorAll('.delete-event-finished').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (confirm('¿Eliminar este evento?')) {
          deleteEvent(id);
        }
      });
    });
    document.querySelectorAll('.event-title').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.closest('.list-group-item').dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== RENDERIZADO DE VISTAS ==========
  function renderView() {
    switch (currentView) {
      case 'day':   renderDayView(); break;
      case 'week':  renderWeekView(); break;
      case 'month': renderMonthView(); break;
      case 'year':  renderYearView(); break;
      default: renderMonthView();
    }
    // Enfocar franja laboral solo en día y semana (después de renderizar)
    if (currentView === 'day' || currentView === 'week') {
      setTimeout(focusWorkHours, 50);
    }
  }

  // ========== VISTA DÍA ==========
  function renderDayView() {
    // ... (código sin cambios, el mismo que ya tenías) ...
    // Asegúrate de que el contenedor tenga scroll: el CSS ya lo permite.
  }

  // ========== VISTA SEMANA ==========
  function renderWeekView() {
    // ... (código sin cambios, el mismo que ya tenías) ...
  }

  // ========== VISTA MES ==========
  function renderMonthView() {
    // ... (código sin cambios) ...
  }

  // ========== VISTA AÑO ==========
  function renderYearView() {
    // ... (código sin cambios) ...
  }

  // ========== MODAL: CREAR / EDITAR ==========
  // ... (código sin cambios) ...

  // ========== NAVEGACIÓN Y VISTAS ==========
  // ... (código sin cambios) ...

  // ========== TOGGLE EVENTOS TERMINADOS ==========
  // ... (código sin cambios) ...

  // ========== EVENT LISTENERS ==========
  // Abrir configuración y sincronizar valores
  settingsBtn.addEventListener('click', function() {
    timeFormatSelect.value = timeFormat;
    workStartInput.value = workStart;
    workEndInput.value = workEnd;
    settingsModal.show();
  });

  // Guardar cambios de formato
  timeFormatSelect.addEventListener('change', function() {
    setTimeFormat(this.value);
  });

  // Guardar cambios de franja laboral
  workStartInput.addEventListener('change', function() {
    let val = parseInt(this.value);
    if (isNaN(val)) val = 8;
    if (val < 0) val = 0;
    if (val > 23) val = 23;
    const end = parseInt(workEndInput.value) || 17;
    if (val >= end) {
      alert('La hora de inicio debe ser anterior a la hora de fin.');
      this.value = workStart;
      return;
    }
    setWorkHours(val, end);
  });

  workEndInput.addEventListener('change', function() {
    let val = parseInt(this.value);
    if (isNaN(val)) val = 17;
    if (val < 0) val = 0;
    if (val > 23) val = 23;
    const start = parseInt(workStartInput.value) || 8;
    if (val <= start) {
      alert('La hora de fin debe ser posterior a la hora de inicio.');
      this.value = workEnd;
      return;
    }
    setWorkHours(start, val);
  });

  // ... (resto de listeners sin cambios) ...

  // ========== INICIO ==========
  loadEventsFromServer();
});
