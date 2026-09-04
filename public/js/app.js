document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========== ESTADO ==========
  let currentDate = new Date();
  let currentView = 'month';
  let events = [];
  let finishedEvents = [];
  let categorias = [];

  let timeFormat = '24';
  let tema = 'claro';

  const HOUR_HEIGHT = 70;
  let endManuallyChanged = false;

  // ========== ELEMENTOS DOM ==========
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const grid = $('#calendarGrid');
  const viewTitle = $('#viewTitle');
  const prevBtn = $('#prevView');
  const nextBtn = $('#nextView');
  const viewBtns = $$('.view-btn');
  const toggleFinishedBtn = $('#toggleFinishedBtn');
  const eventListEl = $('#eventList');
  const finishedListEl = $('#finishedEventsList');

  // Modales
  const settingsModal = new bootstrap.Modal($('#settingsModal'));
  const categoriasModal = new bootstrap.Modal($('#categoriasModal'));
  const modalEvent = new bootstrap.Modal($('#eventModal'));
  const modalDetail = new bootstrap.Modal($('#eventDetailModal'));

  // Elementos configuración
  const timeFormatSelect = $('#timeFormatSelect');
  const themeSelect = $('#themeSelect');
  const saveSettingsBtn = $('#saveSettingsBtn');
  const workStartInput = $('#workStart');
  const workEndInput = $('#workEnd');
  const dayCheckboxes = $$('.form-check-input[id^="day"]');
  const meetingDurationSelect = $('#meetingDuration');
  const contactPhoneInput = $('#contactPhone');
  const meetingAddressInput = $('#meetingAddress');

  // Elementos categorías
  const categoriasList = $('#categoriasList');
  const categoriaForm = $('#categoriaForm');
  const categoriaEditId = $('#categoriaEditId');
  const categoriaNombre = $('#categoriaNombre');
  const categoriaColor = $('#categoriaColor');
  const categoriaSaveBtn = $('#categoriaSaveBtn');
  const categoriaError = $('#categoriaError');

  // Elementos evento (edición)
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
  const eventCategoria = $('#eventCategoria');
  const eventLinkInput = $('#eventLink');
  const eventAddressInput = $('#eventAddress');
  const saveBtn = $('#saveEventBtn');
  const deleteBtn = $('#deleteEventBtn');

  // Elementos detalle
  const detailTitle = $('#detailTitle');
  const detailDescription = $('#detailDescription');
  const detailCategory = $('#detailCategory');
  const detailStatus = $('#detailStatus');
  const detailStart = $('#detailStart');
  const detailEnd = $('#detailEnd');
  const detailAllDay = $('#detailAllDay');
  const detailLink = $('#detailLink');
  const detailAddress = $('#detailAddress');
  const editFromDetailBtn = $('#editFromDetailBtn');

  let currentEventId = null;
  let finishedVisible = false;
  let currentDetailEventId = null;

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

  function formatDateTime(date) {
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + formatTime(date);
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

  // ========== PREFERENCIAS ==========
  async function loadPreferences() {
    try {
      const res = await fetch('/api/preferencias');
      if (!res.ok) throw new Error('Error al cargar preferencias');
      const data = await res.json();
      timeFormat = data.formato_hora || '24';
      tema = data.tema || 'claro';
      applyTheme(tema);

      if (workStartInput) {
        const hours = Math.floor(data.work_start / 60);
        const mins = data.work_start % 60;
        workStartInput.value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
      if (workEndInput) {
        const hours = Math.floor(data.work_end / 60);
        const mins = data.work_end % 60;
        workEndInput.value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
      if (data.work_days) {
        const days = data.work_days.split(',').map(Number);
        dayCheckboxes.forEach(cb => {
          cb.checked = days.includes(parseInt(cb.value));
        });
      }
      if (meetingDurationSelect) {
        meetingDurationSelect.value = data.meeting_duration || 60;
      }
      if (contactPhoneInput) {
        contactPhoneInput.value = data.contact_phone || '';
      }
      if (meetingAddressInput) {
        meetingAddressInput.value = data.meeting_address || '';
      }
    } catch (error) {
      console.error('Error cargando preferencias:', error);
      timeFormat = '24';
      tema = 'claro';
      applyTheme('claro');
    }
  }

  async function savePreferences() {
    const selectedDays = [];
    dayCheckboxes.forEach(cb => {
      if (cb.checked) selectedDays.push(parseInt(cb.value));
    });
    const workDays = selectedDays.length ? selectedDays.join(',') : '';

    const parseTime = (val) => {
      if (!val) return 0;
      const parts = val.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    const payload = {
      tema: themeSelect.value,
      formato_hora: timeFormatSelect.value,
      work_start: parseTime(workStartInput.value),
      work_end: parseTime(workEndInput.value),
      work_days: workDays,
      meeting_duration: parseInt(meetingDurationSelect.value),
      contact_phone: contactPhoneInput.value.trim(),
      meeting_address: meetingAddressInput.value.trim()
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

  // ========== CATEGORÍAS ==========
  async function loadCategorias() {
    try {
      const res = await fetch('/api/categorias');
      if (!res.ok) throw new Error('Error al cargar categorías');
      categorias = await res.json();
      populateCategoriaSelect();
      if (categoriasModal._element.classList.contains('show')) {
        renderCategoriasList();
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  }

  function populateCategoriaSelect() {
    if (!eventCategoria) return;
    const select = eventCategoria;
    select.innerHTML = '<option value="">Sin categoría</option>';
    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      option.style.backgroundColor = cat.color || '#6c757d';
      option.style.color = '#fff';
      select.appendChild(option);
    });
  }

  if (eventCategoria) {
    eventCategoria.addEventListener('change', function() {
      const catId = parseInt(this.value);
      if (!catId) return;
      const cat = categorias.find(c => c.id === catId);
      if (cat && cat.color) {
        colorInput.value = cat.color;
      }
    });
  }

  function renderCategoriasList() {
    if (!categoriasList) return;
    if (categorias.length === 0) {
      categoriasList.innerHTML = '<div class="text-muted small p-2">No hay categorías</div>';
      return;
    }
    let html = '';
    categorias.forEach(cat => {
      html += `
        <div class="list-group-item d-flex justify-content-between align-items-center" data-id="${cat.id}">
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:16px; height:16px; border-radius:4px; background-color:${cat.color || '#6c757d'};"></span>
            <strong>${cat.nombre}</strong>
          </span>
          <span>
            <button class="btn btn-sm btn-outline-secondary edit-categoria" data-id="${cat.id}" title="Editar">✏️</button>
            <button class="btn btn-sm btn-outline-danger delete-categoria" data-id="${cat.id}" title="Eliminar">🗑️</button>
          </span>
        </div>
      `;
    });
    categoriasList.innerHTML = html;

    $$('.edit-categoria', categoriasList).forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        const cat = categorias.find(c => c.id === id);
        if (cat) {
          categoriaEditId.value = cat.id;
          categoriaNombre.value = cat.nombre;
          categoriaColor.value = cat.color || '#6c757d';
          categoriaSaveBtn.textContent = 'Actualizar';
          categoriaError.style.display = 'none';
        }
      });
    });

    $$('.delete-categoria', categoriasList).forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        if (confirm('¿Eliminar esta categoría? Los eventos que la usen quedarán sin categoría.')) {
          deleteCategoria(id);
        }
      });
    });
  }

  async function saveCategoria(e) {
    e.preventDefault();
    const id = categoriaEditId.value;
    const nombre = categoriaNombre.value.trim();
    const color = categoriaColor.value;

    if (!nombre) {
      categoriaError.textContent = 'El nombre es obligatorio.';
      categoriaError.style.display = 'block';
      return;
    }

    const payload = { nombre, color };
    const url = id ? `/api/categorias/${id}` : '/api/categorias';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        categoriaEditId.value = '';
        categoriaNombre.value = '';
        categoriaColor.value = '#6c757d';
        categoriaSaveBtn.textContent = 'Guardar';
        categoriaError.style.display = 'none';
        await loadCategorias();
        renderCategoriasList();
      } else {
        const err = await res.json();
        categoriaError.textContent = err.error || 'Error al guardar';
        categoriaError.style.display = 'block';
      }
    } catch (error) {
      console.error('Error guardando categoría:', error);
      categoriaError.textContent = 'Error de conexión';
      categoriaError.style.display = 'block';
    }
  }

  async function deleteCategoria(id) {
    try {
      const res = await fetch(`/api/categorias/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadCategorias();
        renderCategoriasList();
        loadEventsFromServer();
      } else {
        const err = await res.json();
        alert('Error al eliminar: ' + (err.error || 'desconocido'));
      }
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      alert('Error al eliminar');
    }
  }

  // ========== EVENTOS ==========
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
      const color = ev.color || '#3788d8';
      html += `
        <div class="list-group-item" data-id="${ev.id}">
          <span class="event-title" style="border-left: 4px solid ${color}; padding-left: 8px; cursor:pointer;" title="${ev.title} - ${timeStr}">
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

    $$('.event-title', eventListEl).forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.closest('.list-group-item').dataset.id);
        openDetailModal(id);
      });
    });

    $$('.edit-event', eventListEl).forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        openEditModal(parseInt(this.dataset.id));
      });
    });
    $$('.delete-event', eventListEl).forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('¿Eliminar este evento?')) deleteEvent(parseInt(this.dataset.id));
      });
    });
  }

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
      const color = ev.color || '#3788d8';
      html += `
        <div class="list-group-item" data-id="${ev.id}" style="opacity:0.7;">
          <span class="event-title" style="border-left: 4px solid ${color}; padding-left: 8px; cursor:pointer;" title="${ev.title} - ${timeStr}">
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

    $$('.event-title', finishedListEl).forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.closest('.list-group-item').dataset.id);
        openDetailModal(id);
      });
    });

    $$('.edit-event-finished', finishedListEl).forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        openEditModal(parseInt(this.dataset.id));
      });
    });
    $$('.delete-event-finished', finishedListEl).forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('¿Eliminar este evento?')) deleteEvent(parseInt(this.dataset.id));
      });
    });
  }

  // ========== RENDER VISTAS ==========
  function renderView() {
    if (!grid) return;
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

  // ========== LÍNEA ROJA ==========
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
    const allDayEvents = dayEvents.filter(e => e.all_day === 1 || e.all_day === true);

    viewTitle.textContent = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const totalHeight = 24 * HOUR_HEIGHT;
    let html = `<div class="day-time-grid">`;

    if (allDayEvents.length > 0) {
      html += `<div class="all-day-events-section">`;
      allDayEvents.forEach(e => {
        html += `
          <div class="all-day-event-badge" style="background-color: ${e.color || '#3788d8'};" data-id="${e.id}">
            ${e.title}
          </div>
        `;
      });
      html += `</div>`;
    }

    html += `<div class="day-time-grid-inner">`;
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

    html += `<div class="day-events-column" style="height: ${totalHeight}px; position: relative;">`;
    for (let hour = 0; hour < 24; hour++) {
      html += `<div class="day-hour-slot" data-hour="${hour}" style="height: ${HOUR_HEIGHT}px; border-bottom: 1px solid var(--slot-border, #dee2e6);"></div>`;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr === todayStr) {
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const topPercent = (minutesSinceMidnight / (24 * 60)) * 100;
      html += `
        <div class="current-time-line" style="position: absolute; top: ${Math.min(100, topPercent)}%; left: 0; right: 0; height: 2px; background-color: red; z-index: 10; pointer-events: none; box-shadow: 0 0 4px rgba(255,0,0,0.5);"></div>
      `;
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

    $$('.day-hour-slot').forEach(slot => {
      slot.addEventListener('click', function() {
        const hour = parseInt(this.dataset.hour);
        const dateObj = new Date(currentDate);
        dateObj.setHours(hour, 0, 0, 0);
        openCreateModal(dateObj.toISOString().split('T')[0], hour);
      });
    });
    $$('.all-day-event-badge').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        openDetailModal(parseInt(this.dataset.id));
      });
    });
    $$('.day-event-block').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        openDetailModal(parseInt(this.dataset.id));
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

    let html = `<div class="week-container">`;
    html += `<div class="week-table-scroll">`;
    html += `<table class="week-table">`;
    
    html += `<thead>`;
    html += `<tr>`;
    html += `<th class="week-header-empty"></th>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
      html += `<th class="week-header-day ${isToday ? 'today' : ''}">${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</th>`;
    }
    html += `</tr>`;
    html += `<tr class="all-day-row">`;
    html += `<td class="week-header-empty" style="background-color: var(--header-bg); border-right: 1px solid var(--calendar-border);"></td>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      const allDayEvents = dayEvents.filter(e => e.all_day === 1 || e.all_day === true);
      html += `<td class="week-all-day-cell">`;
      if (allDayEvents.length > 0) {
        allDayEvents.forEach(e => {
          html += `
            <div class="all-day-event-badge" style="background-color: ${e.color || '#3788d8'};" data-id="${e.id}">
              ${e.title}
            </div>
          `;
        });
      }
      html += `</td>`;
    }
    html += `</tr>`;
    html += `</thead>`;
    
    html += `<tbody>`;
    for (let hour = 0; hour < 24; hour++) {
      html += `<tr>`;
      let label;
      if (timeFormat === '12') {
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        label = `${String(hour12).padStart(2, '0')}:00 ${ampm}`;
      } else {
        label = `${String(hour).padStart(2, '0')}:00`;
      }
      html += `<td class="week-hour-label" data-hour="${hour}">${label}</td>`;

      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayEvents = events.filter(e => e.start.startsWith(dateStr));
        const timedEvents = dayEvents.filter(e => e.all_day !== 1 && e.all_day !== true);
        const eventsAtThisHour = timedEvents.filter(e => new Date(e.start).getHours() === hour);

        html += `<td class="week-day-cell" data-date="${dateStr}" data-hour="${hour}">`;
        
        const todayStr = new Date().toISOString().split('T')[0];
        if (dateStr === todayStr) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          if (hour === currentHour) {
            const topPercent = (currentMinute / 60) * 100;
            html += `
              <div class="current-time-line" style="position: absolute; top: ${Math.min(100, topPercent)}%; left: 0; right: 0; height: 2px; background-color: red; z-index: 10; pointer-events: none; box-shadow: 0 0 4px rgba(255,0,0,0.5);"></div>
            `;
          }
        }

        if (eventsAtThisHour.length > 0) {
          const sorted = eventsAtThisHour.sort((a, b) => new Date(a.start) - new Date(b.start));
          const total = sorted.length;
          sorted.forEach((e, index) => {
            const start = new Date(e.start);
            const end = new Date(e.end);
            const startMin = start.getMinutes();
            const endMin = end.getMinutes();
            const duration = endMin - startMin;
            const top = (startMin / 60) * 100;
            const height = (duration / 60) * 100;
            const width = total > 1 ? 80 / total : 100;
            const left = index * (80 / total);
            const timeStr = formatTimeRange(start, end);

            html += `
              <div class="week-event-block" 
                   style="position: absolute; top: ${Math.max(0, top)}%; height: ${Math.max(2, height)}%; left: ${left}%; width: ${width}%; background-color: ${e.color || '#3788d8'};"
                   data-id="${e.id}"
                   title="${e.title} (${timeStr})">
                <span class="event-title-inline">${e.title}</span>
              </div>
            `;
          });
        }
        html += `</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody>`;
    
    html += `</table>`;
    html += `</div>`;
    html += `</div>`;

    grid.innerHTML = html;

    $$('.week-day-cell').forEach(cell => {
      cell.addEventListener('click', function(e) {
        if (e.target.closest('.week-event-block') || e.target.closest('.all-day-event-badge')) return;
        const hour = parseInt(this.dataset.hour);
        const dateStr = this.dataset.date;
        openCreateModal(dateStr, hour);
      });
    });
    $$('.week-event-block').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        openDetailModal(parseInt(this.dataset.id));
      });
    });
    $$('.all-day-event-badge').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        openDetailModal(parseInt(this.dataset.id));
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

      html += `<div class="day ${isToday ? 'today' : ''}" data-year="${year}" data-month="${month}" data-day="${day}" data-date="${dateStr}">`;
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
        const year = parseInt(this.dataset.year);
        const month = parseInt(this.dataset.month);
        const day = parseInt(this.dataset.day);
        currentDate = new Date(year, month, day);
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

        html += `<div class="year-day ${hasEvent ? 'has-event' : ''}" data-year="${year}" data-month="${m}" data-day="${d}" data-date="${dateStr}">`;
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
        const year = parseInt(this.dataset.year);
        const month = parseInt(this.dataset.month);
        const day = parseInt(this.dataset.day);
        currentDate = new Date(year, month, day);
        currentView = 'day';
        updateViewButtons();
        renderView();
      });
    });
  }

  // ========== MODAL DE DETALLE ==========
  function openDetailModal(id) {
    const ev = [...events, ...finishedEvents].find(e => e.id === id);
    if (!ev) {
      alert('Evento no encontrado');
      return;
    }
    currentDetailEventId = id;

    detailTitle.textContent = ev.title || '(sin título)';
    detailDescription.textContent = ev.description || 'Sin descripción';

    if (ev.categoria_id) {
      const cat = categorias.find(c => c.id === ev.categoria_id);
      detailCategory.textContent = cat ? cat.nombre : 'Sin categoría';
    } else {
      detailCategory.textContent = 'Sin categoría';
    }

    const statusLabels = {
      'active': 'Activo',
      'completed': 'Completado',
      'postponed': 'Pospuesto',
      'cancelled': 'Cancelado'
    };
    detailStatus.textContent = statusLabels[ev.status] || ev.status;

    const start = new Date(ev.start);
    const end = new Date(ev.end);
    detailStart.textContent = formatDateTime(start);
    detailEnd.textContent = formatDateTime(end);
    detailAllDay.textContent = ev.all_day ? 'Sí' : 'No';

    detailLink.textContent = ev.link || 'No disponible';
    if (ev.link) {
      detailLink.innerHTML = `<a href="${ev.link}" target="_blank">${ev.link}</a>`;
    }
    detailAddress.textContent = ev.address || 'No disponible';

    modalDetail.show();
  }

  editFromDetailBtn.addEventListener('click', function() {
    if (currentDetailEventId) {
      modalDetail.hide();
      setTimeout(() => {
        openEditModal(currentDetailEventId);
      }, 300);
    }
  });

  // ========== MODAL DE EDICIÓN/CREACIÓN ==========
  function openCreateModal(dateStr, hour) {
    modalTitle.textContent = 'Nuevo evento';
    eventIdInput.value = '';
    form.reset();
    colorInput.value = '#3788d8';
    statusSelect.value = 'active';
    deleteBtn.style.display = 'none';
    currentEventId = null;
    endManuallyChanged = false;

    const formatLocal = (d) => {
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      return local.toISOString().slice(0, 16);
    };

    if (dateStr) {
      const parts = dateStr.split('-').map(Number);
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
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
    eventCategoria.value = '';
    eventLinkInput.value = '';
    eventAddressInput.value = '';
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
      eventCategoria.value = ev.categoria_id || '';
      eventLinkInput.value = ev.link || '';
      eventAddressInput.value = ev.address || '';
      deleteBtn.style.display = 'inline-block';
      currentEventId = ev.id;
      endManuallyChanged = false;
      modalEvent.show();
    } catch (error) {
      console.error('Error al cargar evento para editar:', error);
    }
  }

  startInput.addEventListener('change', function() {
    if (!endManuallyChanged) {
      endInput.value = this.value;
    }
  });

  endInput.addEventListener('change', function() {
    endManuallyChanged = true;
  });

  modalEvent._element.addEventListener('shown.bs.modal', function() {
    endManuallyChanged = false;
  });

  async function saveEvent() {
    const id = eventIdInput.value;
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const start = startInput.value;
    const end = endInput.value;
    const allDay = allDayInput.checked;
    const color = colorInput.value;
    const status = statusSelect.value;
    const categoria_id = eventCategoria.value || null;
    const link = eventLinkInput.value.trim() || null;
    const address = eventAddressInput.value.trim() || null;

    if (!title || !start || !end) {
      alert('Título, inicio y fin son obligatorios');
      return;
    }

    const payload = { title, description, start, end, allDay, color, status, categoria_id, link, address };

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

  // ========== MENÚ HAMBURGUESA ==========
  const menuToggle = document.getElementById('menuToggle');
  const sidebarDesktop = document.getElementById('sidebarDesktop');

  function toggleMobileSidebar() {
    if (!sidebarDesktop) return;
    sidebarDesktop.classList.toggle('mobile-open');
    if (menuToggle) {
      menuToggle.textContent = sidebarDesktop.classList.contains('mobile-open') ? '✕' : '☰';
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', toggleMobileSidebar);
  }

  if (sidebarDesktop) {
    sidebarDesktop.addEventListener('click', function(e) {
      if (!this.classList.contains('mobile-open')) return;
      const target = e.target.closest('.btn, a');
      if (target) {
        if (target.id === 'newEventBtnDesktop' || 
            target.id === 'categoriasBtnDesktop' || 
            target.id === 'settingsBtnDesktop' ||
            target.id === 'toggleFinishedBtnDesktop' ||
            target.id === 'generateInviteBtnDesktop' ||
            target.classList.contains('edit-event') || 
            target.classList.contains('delete-event') || 
            target.classList.contains('edit-event-finished') || 
            target.classList.contains('delete-event-finished') ||
            target.classList.contains('edit-categoria') || 
            target.classList.contains('delete-categoria')) {
          return;
        }
        setTimeout(() => {
          this.classList.remove('mobile-open');
          if (menuToggle) menuToggle.textContent = '☰';
        }, 300);
      }
    });
  }

  // ========== EVENT LISTENERS ==========
  function toggleFinishedEvents() {
    finishedVisible = !finishedVisible;
    if (finishedListEl) {
      finishedListEl.style.display = finishedVisible ? 'block' : 'none';
    }
    const text = finishedVisible ? '📋 Ocultar terminados' : '📋 Eventos terminados';
    const toggleBtn = document.getElementById('toggleFinishedBtn');
    if (toggleBtn) toggleBtn.textContent = text;
    const desktopBtn = document.getElementById('toggleFinishedBtnDesktop');
    if (desktopBtn) desktopBtn.textContent = text;
  }

  const toggleFinishedBtnMobile = document.getElementById('toggleFinishedBtn');
  if (toggleFinishedBtnMobile) {
    toggleFinishedBtnMobile.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFinishedEvents();
    });
  }

  const toggleFinishedBtnDesktop = document.getElementById('toggleFinishedBtnDesktop');
  if (toggleFinishedBtnDesktop) {
    toggleFinishedBtnDesktop.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFinishedEvents();
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);
  viewBtns.forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

  const newEventBtnDesktop = document.getElementById('newEventBtnDesktop');
  if (newEventBtnDesktop) {
    newEventBtnDesktop.addEventListener('click', () => openCreateModal(null));
  }

  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      if (timeFormatSelect) timeFormatSelect.value = timeFormat;
      if (themeSelect) themeSelect.value = tema;
      settingsModal.show();
    });
  }

  const settingsBtnDesktop = document.getElementById('settingsBtnDesktop');
  if (settingsBtnDesktop) {
    settingsBtnDesktop.addEventListener('click', function() {
      if (timeFormatSelect) timeFormatSelect.value = timeFormat;
      if (themeSelect) themeSelect.value = tema;
      settingsModal.show();
    });
  }

  const categoriasBtn = document.getElementById('categoriasBtn');
  if (categoriasBtn) {
    categoriasBtn.addEventListener('click', function() {
      loadCategorias().then(() => {
        renderCategoriasList();
        if (categoriaForm) categoriaForm.reset();
        if (categoriaEditId) categoriaEditId.value = '';
        if (categoriaSaveBtn) categoriaSaveBtn.textContent = 'Guardar';
        if (categoriaError) categoriaError.style.display = 'none';
        categoriasModal.show();
      });
    });
  }

  const categoriasBtnDesktop = document.getElementById('categoriasBtnDesktop');
  if (categoriasBtnDesktop) {
    categoriasBtnDesktop.addEventListener('click', function() {
      loadCategorias().then(() => {
        renderCategoriasList();
        if (categoriaForm) categoriaForm.reset();
        if (categoriaEditId) categoriaEditId.value = '';
        if (categoriaSaveBtn) categoriaSaveBtn.textContent = 'Guardar';
        if (categoriaError) categoriaError.style.display = 'none';
        categoriasModal.show();
      });
    });
  }

  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', savePreferences);
  if (categoriaForm) categoriaForm.addEventListener('submit', saveCategoria);

  if (saveBtn) saveBtn.addEventListener('click', saveEvent);
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
      if (currentEventId && confirm('¿Eliminar este evento?')) deleteEvent(currentEventId);
    });
  }

  if (modalEvent && modalEvent._element) {
    modalEvent._element.addEventListener('hidden.bs.modal', function() {
      currentEventId = null;
      if (deleteBtn) deleteBtn.style.display = 'none';
    });
  }

  // ========== GENERAR ENLACE DE INVITACIÓN ==========
  const generateInviteBtn = document.getElementById('generateInviteBtnDesktop');
  const inviteModalElement = document.getElementById('inviteModal');
  let modalInvite = null;

  if (inviteModalElement) {
    modalInvite = new bootstrap.Modal(inviteModalElement);
  }

  if (generateInviteBtn) {
    generateInviteBtn.addEventListener('click', async function() {
      try {
        const res = await fetch('/api/generate-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
          const err = await res.json();
          alert('Error: ' + (err.error || 'desconocido'));
          return;
        }
        const data = await res.json();
        const linkInput = document.getElementById('inviteLinkInput');
        if (linkInput) {
          linkInput.value = data.link;
        }
        if (modalInvite) {
          modalInvite.show();
        } else {
          alert('Enlace generado: ' + data.link + '\n(Copia manualmente)');
        }
      } catch (error) {
        console.error('Error generando enlace:', error);
        alert('Error al generar enlace');
      }
    });
  }

  const copyInviteBtn = document.getElementById('copyInviteBtn');
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', function() {
      const input = document.getElementById('inviteLinkInput');
      if (!input) return;
      input.select();
      input.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(input.value).then(() => {
        alert('¡Enlace copiado al portapapeles!');
      }).catch(() => {
        document.execCommand('copy');
        alert('¡Enlace copiado al portapapeles!');
      });
    });
  }

  // ========== AUTOCOMPLETADO DE DIRECCIÓN (Google Places) ==========
  let autocompleteService = null;

  function initAutocomplete() {
    // Esta función será llamada por Google cuando la API esté lista
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      autocompleteService = new google.maps.places.AutocompleteService();
      meetingAddressInput.addEventListener('input', handleAddressInput);
    }
  }

  function handleAddressInput() {
    const input = meetingAddressInput.value;
    if (input.length < 3) {
      document.getElementById('autocomplete-suggestions').style.display = 'none';
      return;
    }

    if (!autocompleteService) return;

    const request = {
      input: input,
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'es' } // Puedes quitar o cambiar el país
    };

    autocompleteService.getPlacePredictions(request, function(predictions, status) {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        const suggestions = document.getElementById('autocomplete-suggestions');
        suggestions.style.display = 'block';
        suggestions.innerHTML = '';
        predictions.forEach(pred => {
          const item = document.createElement('a');
          item.className = 'list-group-item list-group-item-action';
          item.textContent = pred.description;
          item.addEventListener('click', function(e) {
            e.preventDefault();
            meetingAddressInput.value = pred.description;
            suggestions.style.display = 'none';
          });
          suggestions.appendChild(item);
        });
      } else {
        document.getElementById('autocomplete-suggestions').style.display = 'none';
      }
    });
  }

  // Inicializar autocompletado si la API ya está cargada
  if (typeof google !== 'undefined' && google.maps && google.maps.places) {
    initAutocomplete();
  }

  // Cerrar sugerencias al hacer clic fuera
  document.addEventListener('click', function(e) {
    const suggestions = document.getElementById('autocomplete-suggestions');
    if (suggestions && !suggestions.contains(e.target) && e.target !== meetingAddressInput) {
      suggestions.style.display = 'none';
    }
  });

  // ========== INICIO ==========
  loadPreferences().then(() => {
    loadCategorias().then(() => {
      loadEventsFromServer();
    });
  });
});
