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
    const date = currentDate;
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = events.filter(e => e.start.startsWith(dateStr));
    const timedEvents = dayEvents.filter(e => e.all_day !== 1 && e.all_day !== true);

    viewTitle.textContent = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const totalHeight = 24 * HOUR_HEIGHT;

    let html = `<div class="day-time-grid">`;
    html += `<div class="day-time-grid-inner">`;

    // Columna de horas
    html += `<div class="day-time-column" style="height: ${totalHeight}px;">`;
    for (let hour = 0; hour < 24; hour++) {
      let label;
      if (timeFormat === '12') {
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        label = `${String(hour12).padStart(2, '0')}:00 ${ampm}`;
      } else {
        label = `${String(hour).padStart(2, '0')}:00`;
      }
      html += `<div class="day-hour-label" data-hour="${hour}" style="height: ${HOUR_HEIGHT}px;">${label}</div>`;
    }
    html += `</div>`;

    // Columna de eventos
    html += `<div class="day-events-column" style="height: ${totalHeight}px; position: relative;">`;
    for (let hour = 0; hour < 24; hour++) {
      html += `<div class="day-hour-slot" data-hour="${hour}" style="height: ${HOUR_HEIGHT}px; border-bottom: 1px solid var(--slot-border, #dee2e6);"></div>`;
    }

    // Línea roja (hoy)
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr === todayStr) {
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const topPercent = (minutesSinceMidnight / (24 * 60)) * 100;
      html += `
        <div class="current-time-line" style="position: absolute; top: ${Math.min(100, topPercent)}%; left: 0; right: 0; height: 2px; background-color: red; z-index: 10; pointer-events: none; box-shadow: 0 0 4px rgba(255,0,0,0.5);"></div>
      `;
    }

    // Eventos
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

    $$('.day-hour-slot').forEach(slot => {
      slot.addEventListener('click', function() {
        const hour = parseInt(this.dataset.hour);
        const dateObj = new Date(currentDate);
        dateObj.setHours(hour, 0, 0, 0);
        openCreateModal(dateObj.toISOString().split('T')[0], hour);
      });
    });
    $$('.day-event-block').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        openEditModal(parseInt(this.dataset.id));
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

    const totalHeight = 24 * HOUR_HEIGHT;
    const colTemplate = `70px repeat(7, 1fr)`;

    let html = `<div class="week-time-grid" style="display: grid; grid-template-columns: ${colTemplate}; grid-template-rows: auto 1fr; height: 100%; overflow: hidden;">`;

    // CABECERA
    html += `<div class="week-header" style="display: contents;">`;
    html += `<div class="week-header-empty" style="grid-column: 1; grid-row: 1; border-right: 1px solid var(--calendar-border, #dee2e6);"></div>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
      html += `<div class="week-header-day ${isToday ? 'today' : ''}" style="grid-column: ${i + 2}; grid-row: 1; border-left: 1px solid var(--calendar-border, #dee2e6);">${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</div>`;
    }
    html += `</div>`;

    // CUERPO
    html += `<div class="week-body-wrapper" style="grid-column: 1 / -1; grid-row: 2; overflow-y: auto; position: relative; background-color: var(--calendar-bg);">`;
    html += `<div class="week-body-grid" style="display: grid; grid-template-columns: ${colTemplate}; height: ${totalHeight}px;">`;

    // Columna horas
    html += `<div class="week-hours-column" style="display: flex; flex-direction: column; height: 100%; border-right: 1px solid var(--slot-border, #dee2e6);">`;
    for (let hour = 0; hour < 24; hour++) {
      let label;
      if (timeFormat === '12') {
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        label = `${String(hour12).padStart(2, '0')}:00 ${ampm}`;
      } else {
        label = `${String(hour).padStart(2, '0')}:00`;
      }
      html += `<div class="week-hour-label" data-hour="${hour}" style="height: ${HOUR_HEIGHT}px; border-bottom: 1px solid var(--slot-border, #dee2e6);">${label}</div>`;
    }
    html += `</div>`;

    // Días
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      const timedEvents = dayEvents.filter(e => e.all_day !== 1 && e.all_day !== true);

      html += `<div class="week-day-column" data-date="${dateStr}" style="position: relative; height: 100%; display: flex; flex-direction: column; border-left: 1px solid var(--calendar-border, #dee2e6);">`;
      for (let hour = 0; hour < 24; hour++) {
        html += `<div class="week-hour-slot" data-hour="${hour}" data-date="${dateStr}" style="height: ${HOUR_HEIGHT}px; border-bottom: 1px solid var(--slot-border, #dee2e6);"></div>`;
      }
      // Línea roja
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateStr === todayStr) {
        const now = new Date();
        const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
        const topPercent = (minutesSinceMidnight / (24 * 60)) * 100;
        html += `
          <div class="current-time-line" style="position: absolute; top: ${Math.min(100, topPercent)}%; left: 0; right: 0; height: 2px; background-color: red; z-index: 10; pointer-events: none; box-shadow: 0 0 4px rgba(255,0,0,0.5);"></div>
        `;
      }
      // Eventos
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

    html += `</div>`;
    html += `</div>`;
    html += `</div>`;

    grid.innerHTML = html;

    $$('.week-hour-slot').forEach(slot => {
      slot.addEventListener('click', function() {
        const hour = parseInt(this.dataset.hour);
        const dateStr = this.dataset.date;
        openCreateModal(dateStr, hour);
      });
    });
    $$('.week-event-block').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        openEditModal(parseInt(this.dataset.id));
      });
    });
  }

  // ========== VISTA MES ==========
  function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    viewTitle.textContent = `${firstDay.toLocaleString('es', { month: 'long' })} ${year}`;

    let html = '<div class="calendar-weekdays">';
    ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].forEach(d => html += `<div class="weekday">${d}</div>`);
    html += '</div><div class="calendar-days">';

    for (let i = 0; i < startDayOfWeek; i++) html += '<div class="day empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      html += `<div class="day ${isToday ? 'today' : ''}" data-date="${dateStr}">`;
      html += `<span class="day-number">${day}</span>`;
      if (dayEvents.length > 0) {
        html += `<div class="event-bars">`;
        const maxBars = Math.min(dayEvents.length, 3);
        for (let i = 0; i < maxBars; i++) {
          const e = dayEvents[i];
          html += `<div class="event-bar" style="background-color: ${e.color || '#3788d8'};"></div>`;
        }
        if (dayEvents.length > 3) html += `<div class="event-bar-more">+${dayEvents.length - 3}</div>`;
        html += `</div>`;
      }
      html += '</div>';
    }

    const remaining = (7 - ((startDayOfWeek + daysInMonth) % 7)) % 7;
    for (let i = 0; i < remaining; i++) html += '<div class="day empty"></div>';

    html += '</div>';
    grid.innerHTML = html;

    $$('.day:not(.empty)').forEach(el => {
      el.addEventListener('click', function() {
        currentDate = new Date(this.dataset.date);
        currentView = 'day';
        updateViewButtons();
        renderView();
      });
    });
  }

  // ========== VISTA AÑO ==========
  function renderYearView() {
    const year = currentDate.getFullYear();
    viewTitle.textContent = year;

    let html = `<div class="year-grid">`;
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(year, m, 1);
      const monthName = monthDate.toLocaleString('es', { month: 'long' });
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const firstDayOfMonth = new Date(year, m, 1).getDay();

      html += `<div class="year-month" data-month="${m}">`;
      html += `<div class="year-month-title">${monthName}</div>`;
      html += `<div class="year-month-days">`;
      for (let i = 0; i < firstDayOfMonth; i++) {
        html += `<div class="year-day empty"></div>`;
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, m, d);
        const dateStr = dateObj.toISOString().split('T')[0];
        const dayEvents = events.filter(e => e.start.startsWith(dateStr));
        const hasEvent = dayEvents.length > 0;

        html += `<div class="year-day ${hasEvent ? 'has-event' : ''}" data-date="${dateStr}">`;
        html += `<span class="year-day-number">${d}</span>`;
        if (hasEvent) {
          html += `<div class="year-day-dots">`;
          const maxDots = Math.min(dayEvents.length, 3);
          for (let i = 0; i < maxDots; i++) {
            html += `<span class="year-dot" style="background-color: ${dayEvents[i].color || '#3788d8'};"></span>`;
          }
          if (dayEvents.length > 3) html += `<span class="year-dot-more">+${dayEvents.length - 3}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
    grid.innerHTML = html;

    $$('.year-month').forEach(el => {
      el.addEventListener('click', function() {
        const month = parseInt(this.dataset.month);
        currentDate = new Date(year, month, 1);
        currentView = 'month';
        updateViewButtons();
        renderView();
      });
    });
    $$('.year-day:not(.empty)').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const date = this.dataset.date;
        if (date) {
          currentDate = new Date(date);
          currentView = 'day';
          updateViewButtons();
          renderView();
        }
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

    const formatLocal = (d) => {
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      return local.toISOString().slice(0, 16);
    };

    if (dateStr) {
      const date = new Date(dateStr);
      if (hour !== undefined) date.setHours(hour, 0, 0, 0);
      else date.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(end.getHours() + 1);
      startInput.value = formatLocal(date);
      endInput.value = formatLocal(end);
    } else {
      const now = new Date();
      const later = new Date(now);
      later.setHours(later.getHours() + 1);
      startInput.value = formatLocal(now);
      endInput.value = formatLocal(later);
    }
    allDayInput.checked = false;
    modalEvent.show();
  }

  async function openEditModal(id) {
    try {
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
      modalEvent.show();
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
      const url = id ? `/api/events/${id}` : '/api/events';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        modalEvent.hide();
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
        modalEvent.hide();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'desconocido'));
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar');
    }
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
    viewBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === currentView));
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
  viewBtns.forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  newEventBtn.addEventListener('click', () => openCreateModal(null));

  settingsBtn.addEventListener('click', function() {
    timeFormatSelect.value = timeFormat;
    themeSelect.value = tema;
    settingsModal.show();
  });

  saveSettingsBtn.addEventListener('click', savePreferences);

  saveBtn.addEventListener('click', saveEvent);
  deleteBtn.addEventListener('click', function() {
    if (currentEventId && confirm('¿Eliminar este evento?')) deleteEvent(currentEventId);
  });

  modalEvent._element.addEventListener('hidden.bs.modal', function() {
    currentEventId = null;
    deleteBtn.style.display = 'none';
  });

  // ========== INICIO ==========
  loadPreferences().then(() => {
    loadEventsFromServer();
  });
});
