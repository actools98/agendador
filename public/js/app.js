document.addEventListener('DOMContentLoaded', function() {
  // ========== ESTADO ==========
  let currentDate = new Date();
  let currentView = 'month';
  let events = [];
  let finishedEvents = []; // eventos con status != 'active'

  // Preferencias (desde localStorage)
  let timeFormat = localStorage.getItem('calendar_time_format') || '24';

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

  // Modal de configuración
  const settingsModalElement = document.getElementById('settingsModal');
  const settingsModal = new bootstrap.Modal(settingsModalElement);
  const timeFormatSelect = document.getElementById('timeFormatSelect');

  // Modal de eventos
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

  function setTimeFormat(format) {
    timeFormat = format;
    localStorage.setItem('calendar_time_format', format);
    if (timeFormatSelect) timeFormatSelect.value = format;
    renderView();
    renderEventList();
    renderFinishedList();
  }

  // ========== CARGAR EVENTOS ==========
  async function loadEventsFromServer() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Error al cargar eventos');
      const allEvents = await res.json();
      // Separar activos y terminados
      events = allEvents.filter(e => e.status === 'active');
      finishedEvents = allEvents.filter(e => e.status !== 'active' && e.status !== undefined);
      // Asegurar que los eventos antiguos (sin status) se traten como activos
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
  }

  // ========== VISTA DÍA (solo eventos activos) ==========
  function renderDayView() {
    const date = currentDate;
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = events.filter(e => e.start.startsWith(dateStr));

    viewTitle.textContent = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let html = `<div class="day-time-grid">`;
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
    if (dayEvents.length > 0) {
      const sorted = [...dayEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
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
    html += `</div></div>`;
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
    document.querySelectorAll('.day-event-block').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== VISTA SEMANA (solo eventos activos) ==========
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

      html += `<div class="week-day-column" data-date="${dateStr}" style="position: relative; display: flex; flex-direction: column;">`;
      for (let hour = 0; hour < 24; hour++) {
        html += `<div class="week-hour-slot" data-hour="${hour}" data-date="${dateStr}" style="flex: 1; border-bottom: 1px solid #2a2a3a;"></div>`;
      }
      if (dayEvents.length > 0) {
        const sorted = [...dayEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
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
    document.querySelectorAll('.week-event-block').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== VISTA MES (solo eventos activos) ==========
  function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    viewTitle.textContent = `${firstDay.toLocaleString('es', { month: 'long' })} ${year}`;

    let html = '<div class="calendar-weekdays">';
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    weekdays.forEach(day => html += `<div class="weekday">${day}</div>`);
    html += '</div><div class="calendar-days">';

    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="day empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      const isToday = (new Date().toISOString().split('T')[0] === dateStr);

      html += `<div class="day ${isToday ? 'today' : ''}" data-date="${dateStr}">`;
      html += `<span class="day-number">${day}</span>`;
      if (dayEvents.length > 0) {
        html += `<div class="event-bars">`;
        const maxBars = Math.min(dayEvents.length, 3);
        for (let i = 0; i < maxBars; i++) {
          const e = dayEvents[i];
          html += `<div class="event-bar" style="background-color: ${e.color || '#3788d8'};"></div>`;
        }
        if (dayEvents.length > 3) {
          html += `<div class="event-bar-more">+${dayEvents.length - 3}</div>`;
        }
        html += `</div>`;
      }
      html += '</div>';
    }
    const totalCells = startDayOfWeek + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remaining; i++) {
      html += '<div class="day empty"></div>';
    }
    html += '</div>';
    grid.innerHTML = html;

    document.querySelectorAll('.day:not(.empty)').forEach(el => {
      el.addEventListener('click', function() {
        const date = this.dataset.date;
        currentDate = new Date(date);
        currentView = 'day';
        updateViewButtons();
        renderView();
      });
    });
  }

  // ========== VISTA AÑO (solo eventos activos) ==========
  function renderYearView() {
    const year = currentDate.getFullYear();
    viewTitle.textContent = year;

    let html = `<div class="year-grid">`;
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(year, m, 1);
      const monthName = monthDate.toLocaleString('es', { month: 'long' });
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      html += `<div class="year-month" data-month="${m}">`;
      html += `<div class="year-month-title">${monthName}</div>`;
      html += `<div class="year-month-days">`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, m, d);
        const dateStr = dateObj.toISOString().split('T')[0];
        const hasEvent = events.some(e => e.start.startsWith(dateStr));
        html += `<span class="year-day ${hasEvent ? 'has-event' : ''}" data-date="${dateStr}">${d}</span>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
    grid.innerHTML = html;

    document.querySelectorAll('.year-month').forEach(el => {
      el.addEventListener('click', function() {
        const month = parseInt(this.dataset.month);
        currentDate = new Date(year, month, 1);
        currentView = 'month';
        updateViewButtons();
        renderView();
      });
    });
    document.querySelectorAll('.year-day.has-event').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const date = this.dataset.date;
        currentDate = new Date(date);
        currentView = 'day';
        updateViewButtons();
        renderView();
      });
    });
  }

  // ========== MODAL: CREAR / EDITAR ==========
  function openCreateModal(dateStr, hour) {
    modalTitle.textContent = 'Nuevo evento';
    eventIdInput.value = '';
    form.reset();
    colorInput.value = '#3788d8';
    statusSelect.value = 'active';
    deleteBtn.style.display = 'none';
    currentEventId = null;

    if (dateStr) {
      const date = new Date(dateStr);
      if (hour !== undefined) date.setHours(hour, 0, 0, 0);
      else date.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(end.getHours() + 1);
      const formatLocal = (d) => {
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
      };
      startInput.value = formatLocal(date);
      endInput.value = formatLocal(end);
    } else {
      const now = new Date();
      const later = new Date(now);
      later.setHours(later.getHours() + 1);
      const formatLocal = (d) => {
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
      };
      startInput.value = formatLocal(now);
      endInput.value = formatLocal(later);
    }
    allDayInput.checked = false;
    modal.show();
  }

  async function openEditModal(id) {
    try {
      // Buscar en ambos arrays
      const ev = [...events, ...finishedEvents].find(e => e.id === id);
      if (!ev) {
        alert('Evento no encontrado');
        return;
      }
      modalTitle.textContent = 'Editar evento';
      eventIdInput.value = ev.id;
      titleInput.value = ev.title;
      descriptionInput.value = ev.description || '';
      const formatLocal = (dateStr) => {
        const d = new Date(dateStr);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
      };
      startInput.value = formatLocal(ev.start);
      endInput.value = formatLocal(ev.end);
      allDayInput.checked = ev.all_day === 1;
      colorInput.value = ev.color || '#3788d8';
      statusSelect.value = ev.status || 'active';
      deleteBtn.style.display = 'inline-block';
      currentEventId = ev.id;
      modal.show();
    } catch (error) {
      console.error('Error al cargar evento para editar:', error);
    }
  }

  async function saveEvent() {
    const id = eventIdInput.value;
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const start = startInput.value;
    const end = endInput.value;
    const allDay = allDayInput.checked;
    const color = colorInput.value;
    const status = statusSelect.value;

    if (!title || !start || !end) {
      alert('Título, inicio y fin son obligatorios');
      return;
    }

    const payload = { title, description, start, end, allDay, color, status };

    try {
      let url = '/api/events';
      let method = 'POST';
      if (id) {
        url += `/${id}`;
        method = 'PUT';
      }
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        modal.hide();
        loadEventsFromServer();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'desconocido'));
      }
    } catch (error) {
      console.error('Error al guardar evento:', error);
      alert('Error al guardar');
    }
  }

  async function deleteEvent(id) {
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadEventsFromServer();
        modal.hide();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'desconocido'));
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar');
    }
  }

  // ========== NAVEGACIÓN Y VISTAS ==========
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

  // ========== TOGGLE EVENTOS TERMINADOS ==========
  toggleFinishedBtn.addEventListener('click', function() {
    finishedVisible = !finishedVisible;
    finishedListEl.style.display = finishedVisible ? 'block' : 'none';
    this.textContent = finishedVisible ? '📋 Ocultar terminados' : '📋 Eventos terminados';
  });

  // ========== EVENT LISTENERS ==========
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  viewBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      setView(this.dataset.view);
    });
  });

  newEventBtn.addEventListener('click', () => openCreateModal(null));

  settingsBtn.addEventListener('click', () => {
    timeFormatSelect.value = timeFormat;
    settingsModal.show();
  });

  timeFormatSelect.addEventListener('change', function() {
    setTimeFormat(this.value);
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
  loadEventsFromServer();
});
