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
  const workStartLabel = document.getElementById('workStartLabel');
  const workEndLabel = document.getElementById('workEndLabel');
  const workStartFormat = document.getElementById('workStartFormat');
  const workEndFormat = document.getElementById('workEndFormat');
  const workStartExample = document.getElementById('workStartExample');
  const workEndExample = document.getElementById('workEndExample');

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

  // ========== ACTUALIZAR ETIQUETAS DE FRANJA HORARIA ==========
  function updateWorkLabels() {
    const is24 = timeFormat === '24';
    // Actualizar labels
    workStartLabel.textContent = is24 ? 'Inicio (HH:00)' : 'Inicio (HH:00 AM/PM)';
    workEndLabel.textContent = is24 ? 'Fin (HH:00)' : 'Fin (HH:00 AM/PM)';
    workStartFormat.textContent = is24 ? ':00' : ':00';
    workEndFormat.textContent = is24 ? ':00' : ':00';
    // Actualizar ejemplos
    const startHour = parseInt(workStartInput.value) || 8;
    const endHour = parseInt(workEndInput.value) || 17;
    const startDate = new Date();
    startDate.setHours(startHour, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(endHour, 0, 0, 0);
    workStartExample.textContent = `Ej: ${formatTime(startDate, timeFormat)}`;
    workEndExample.textContent = `Ej: ${formatTime(endDate, timeFormat)}`;
  }

  // ========== GUARDAR CONFIGURACIÓN ==========
  function setTimeFormat(format) {
    timeFormat = format;
    localStorage.setItem('calendar_time_format', format);
    if (timeFormatSelect) timeFormatSelect.value = format;
    updateWorkLabels();
    renderView();
    renderEventList();
    renderFinishedList();
  }

  function setWorkHours(start, end) {
    workStart = start;
    workEnd = end;
    localStorage.setItem('work_start', start);
    localStorage.setItem('work_end', end);
    if (workStartInput) workStartInput.value = start;
    if (workEndInput) workEndInput.value = end;
    updateWorkLabels();
    if (currentView === 'day' || currentView === 'week') {
      renderView();
    }
  }

  // ========== ENFOQUE EN FRANJA LABORAL (SIMPLE) ==========
  function focusWorkHours() {
    if (currentView !== 'day' && currentView !== 'week') return;
    
    setTimeout(() => {
      let container;
      if (currentView === 'day') {
        container = document.querySelector('.day-time-grid');
      } else {
        container = document.querySelector('.week-body-wrapper');
      }
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
    }, 100);
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
    focusWorkHours();
  }

  // ========== VISTA DÍA ==========
  function renderDayView() {
    const date = currentDate;
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = events.filter(e => e.start.startsWith(dateStr));

    const allDayEvents = dayEvents.filter(e => e.all_day === 1 || e.all_day === true);
    const timedEvents = dayEvents.filter(e => e.all_day !== 1 && e.all_day !== true);

    viewTitle.textContent = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let html = `<div class="day-time-grid">`;

    if (allDayEvents.length > 0) {
      html += `<div class="day-all-day-section">`;
      html += `<div class="day-all-day-label">📌 Todo el día</div>`;
      html += `<div class="day-all-day-events">`;
      allDayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      allDayEvents.forEach(e => {
        const color = e.color || '#3788d8';
        html += `
          <div class="day-all-day-event" style="background-color: ${color}66; border-left: 4px solid ${color};" data-id="${e.id}">
            <span>${e.title}</span>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    html += `<div class="day-time-grid-inner">`;
    html += `<div class="day-time-column">`;
    for (let hour = 0; hour < 24; hour++) {
      let label;
      if (timeFormat === '12') {
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        label = `${String(hour12).padStart(2, '0')}:00 ${ampm}`;
      } else {
        label = `${String(hour).padStart(2, '0')}:00`;
      }
      html += `<div class="day-hour-label" data-hour="${hour}">${label}</div>`;
    }
    html += `</div>`;

    html += `<div class="day-events-column" style="position: relative; display: flex; flex-direction: column;">`;
    for (let hour = 0; hour < 24; hour++) {
      html += `<div class="day-hour-slot" data-hour="${hour}" style="flex: 1; border-bottom: 1px solid #2a2a3a;"></div>`;
    }
    if (timedEvents.length > 0) {
      const sorted = [...timedEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
      const hourCounts = {};
      sorted.forEach(e => {
        const startHour = new Date(e.start).getHours();
        if (!hourCounts[startHour]) hourCounts[startHour] = [];
        hourCounts[startHour].push(e);
      });
      sorted.forEach(e => {
        const start = new Date(e.start);
        const end = new Date(e.end);
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const duration = endMinutes - startMinutes;
        const top = (startMinutes / (24 * 60)) * 100;
        const height = (duration / (24 * 60)) * 100;

        const hour = start.getHours();
        const eventsInHour = hourCounts[hour] || [];
        const index = eventsInHour.indexOf(e);
        const totalInHour = eventsInHour.length;
        const width = totalInHour > 1 ? 80 / totalInHour : 100;
        const left = index * (80 / totalInHour);

        const timeStr = formatTimeRange(start, end);

        html += `
          <div class="day-event-block" 
               style="top: ${Math.max(0, top)}%; height: ${Math.max(2, height)}%; left: ${left}%; width: ${width}%; background-color: ${e.color || '#3788d8'};"
               data-id="${e.id}"
               title="${e.title} (${timeStr})">
            <span class="event-title-inline">${e.title}</span>
          </div>
        `;
      });
    }
    html += `</div></div></div>`;

    grid.innerHTML = html;

    document.querySelectorAll('.day-hour-slot').forEach(slot => {
      slot.addEventListener('click', function() {
        const hour = parseInt(this.dataset.hour);
        const dateObj = new Date(currentDate);
        dateObj.setHours(hour, 0, 0, 0);
        const dateStrForModal = dateObj.toISOString().split('T')[0];
        openCreateModal(dateStrForModal, hour);
      });
    });
    document.querySelectorAll('.day-event-block, .day-all-day-event').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== VISTA SEMANA ==========
  function renderWeekView() {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    viewTitle.textContent = `${startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    let html = `<div class="week-time-grid">`;
    html += `<div class="week-header">`;
    html += `<div class="week-header-empty"></div>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
      html += `<div class="week-header-day ${isToday ? 'today' : ''}">${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</div>`;
    }
    html += `</div>`;

    html += `<div class="week-all-day-row">`;
    html += `<div class="week-all-day-label">📌 Todo el día</div>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      const allDayEvents = dayEvents.filter(e => e.all_day === 1 || e.all_day === true);
      html += `<div class="week-all-day-cell" data-date="${dateStr}">`;
      if (allDayEvents.length > 0) {
        allDayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
        allDayEvents.forEach(e => {
          const color = e.color || '#3788d8';
          html += `
            <div class="week-all-day-event" style="background-color: ${color}66; border-left: 4px solid ${color};" data-id="${e.id}">
              <span>${e.title}</span>
            </div>
          `;
        });
      }
      html += `</div>`;
    }
    html += `</div>`;

    html += `<div class="week-body-wrapper">`;
    html += `<div class="week-hours-column">`;
    for (let hour = 0; hour < 24; hour++) {
      let label;
      if (timeFormat === '12') {
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        label = `${String(hour12).padStart(2, '0')}:00 ${ampm}`;
      } else {
        label = `${String(hour).padStart(2, '0')}:00`;
      }
      html += `<div class="week-hour-label" data-hour="${hour}">${label}</div>`;
    }
    html += `</div>`;

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      const timedEvents = dayEvents.filter(e => e.all_day !== 1 && e.all_day !== true);

      html += `<div class="week-day-column" data-date="${dateStr}" style="position: relative; display: flex; flex-direction: column;">`;
      for (let hour = 0; hour < 24; hour++) {
        html += `<div class="week-hour-slot" data-hour="${hour}" data-date="${dateStr}" style="flex: 1; border-bottom: 1px solid #2a2a3a;"></div>`;
      }
      if (timedEvents.length > 0) {
        const sorted = [...timedEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
        const hourCounts = {};
        sorted.forEach(e => {
          const startHour = new Date(e.start).getHours();
          if (!hourCounts[startHour]) hourCounts[startHour] = [];
          hourCounts[startHour].push(e);
        });
        sorted.forEach(e => {
          const start = new Date(e.start);
          const end = new Date(e.end);
          const startMinutes = start.getHours() * 60 + start.getMinutes();
          const endMinutes = end.getHours() * 60 + end.getMinutes();
          const duration = endMinutes - startMinutes;
          const top = (startMinutes / (24 * 60)) * 100;
          const height = (duration / (24 * 60)) * 100;

          const hour = start.getHours();
          const eventsInHour = hourCounts[hour] || [];
          const index = eventsInHour.indexOf(e);
          const totalInHour = eventsInHour.length;
          const width = totalInHour > 1 ? 80 / totalInHour : 100;
          const left = index * (80 / totalInHour);

          const timeStr = formatTimeRange(start, end);

          html += `
            <div class="week-event-block" 
                 style="top: ${Math.max(0, top)}%; height: ${Math.max(2, height)}%; left: ${left}%; width: ${width}%; background-color: ${e.color || '#3788d8'};"
                 data-id="${e.id}"
                 title="${e.title} (${timeStr})">
              <span class="event-title-inline">${e.title}</span>
            </div>
          `;
        });
      }
      html += `</div>`;
    }

    html += `</div></div>`;

    grid.innerHTML = html;

    document.querySelectorAll('.week-hour-slot').forEach(slot => {
      slot.addEventListener('click', function() {
        const hour = parseInt(this.dataset.hour);
        const dateStr = this.dataset.date;
        openCreateModal(dateStr, hour);
      });
    });
    document.querySelectorAll('.week-event-block, .week-all-day-event').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== VISTA MES (aquí debes tener tu código completo) ==========
  function renderMonthView() {
    // (Mantén tu código existente, no lo modifico aquí para no repetir)
    // Si necesitas, te lo puedo enviar completo, pero asumo que ya lo tienes.
  }

  // ========== VISTA AÑO (aquí debes tener tu código completo) ==========
  function renderYearView() {
    // (Mantén tu código existente)
  }

  // ========== MODAL: CREAR / EDITAR (aquí debes tener tu código completo) ==========
  function openCreateModal(dateStr, hour) {
    // (Mantén tu código existente)
  }

  async function openEditModal(id) {
    // (Mantén tu código existente)
  }

  async function saveEvent() {
    // (Mantén tu código existente)
  }

  async function deleteEvent(id) {
    // (Mantén tu código existente)
  }

  // ========== NAVEGACIÓN ==========
  function prev() {
    switch (currentView) {
      case 'day':   currentDate.setDate(currentDate.getDate() - 1); break;
      case 'week':  currentDate.setDate(currentDate.getDate() - 7); break;
      case 'month': currentDate.setMonth(currentDate.getMonth() - 1); break;
      case 'year':  currentDate.setFullYear(currentDate.getFullYear() - 1); break;
    }
    renderView();
  }

  function next() {
    switch (currentView) {
      case 'day':   currentDate.setDate(currentDate.getDate() + 1); break;
      case 'week':  currentDate.setDate(currentDate.getDate() + 7); break;
      case 'month': currentDate.setMonth(currentDate.getMonth() + 1); break;
      case 'year':  currentDate.setFullYear(currentDate.getFullYear() + 1); break;
    }
    renderView();
  }

  function updateViewButtons() {
    viewBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === currentView);
    });
  }

  function setView(view) {
    currentView = view;
    updateViewButtons();
    renderView();
  }

  // ========== EVENT LISTENERS ==========
  toggleFinishedBtn.addEventListener('click', function() {
    finishedVisible = !finishedVisible;
    finishedListEl.style.display = finishedVisible ? 'block' : 'none';
    this.textContent = finishedVisible ? '📋 Ocultar terminados' : '📋 Eventos terminados';
  });

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  viewBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      setView(this.dataset.view);
    });
  });

  newEventBtn.addEventListener('click', () => openCreateModal(null));

  settingsBtn.addEventListener('click', function() {
    timeFormatSelect.value = timeFormat;
    workStartInput.value = workStart;
    workEndInput.value = workEnd;
    updateWorkLabels();
    settingsModal.show();
  });

  timeFormatSelect.addEventListener('change', function() {
    setTimeFormat(this.value);
  });

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

  saveBtn.addEventListener('click', saveEvent);
  deleteBtn.addEventListener('click', function() {
    if (currentEventId && confirm('¿Eliminar este evento?')) {
      deleteEvent(currentEventId);
    }
  });

  modalElement.addEventListener('hidden.bs.modal', function () {
    currentEventId = null;
    deleteBtn.style.display = 'none';
  });

  // ========== INICIO ==========
  // Actualizar etiquetas al cargar
  updateWorkLabels();
  loadEventsFromServer();
});
