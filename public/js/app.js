document.addEventListener('DOMContentLoaded', function() {
  // ========== ESTADO ==========
  let currentDate = new Date();
  let currentView = 'month'; // 'day', 'week', 'month', 'year'
  let events = [];

  // ========== ELEMENTOS DOM ==========
  const grid = document.getElementById('calendarGrid');
  const viewTitle = document.getElementById('viewTitle');
  const prevBtn = document.getElementById('prevView');
  const nextBtn = document.getElementById('nextView');
  const viewBtns = document.querySelectorAll('.view-btn');
  const newEventBtn = document.getElementById('newEventBtn');
  const eventListEl = document.getElementById('eventList');

  // Modal
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
  const saveBtn = document.getElementById('saveEventBtn');
  const deleteBtn = document.getElementById('deleteEventBtn');

  let currentEventId = null;

  // ========== CARGAR EVENTOS ==========
  async function loadEventsFromServer() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Error al cargar eventos');
      events = await res.json();
      renderView();
      renderEventList();
    } catch (error) {
      console.error('Error cargando eventos:', error);
    }
  }

  // ========== RENDERIZADO SEGÚN VISTA ==========
  function renderView() {
    switch (currentView) {
      case 'day':   renderDayView(); break;
      case 'week':  renderWeekView(); break;
      case 'month': renderMonthView(); break;
      case 'year':  renderYearView(); break;
      default: renderMonthView();
    }
  }

  // ========== VISTA DÍA ==========
  function renderDayView() {
    const date = currentDate;
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = events.filter(e => e.start.startsWith(dateStr));

    viewTitle.textContent = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let html = `<div class="day-view">`;
    html += `<div class="day-view-header">Eventos del día</div>`;
    if (dayEvents.length === 0) {
      html += `<div class="day-view-empty">No hay eventos este día</div>`;
    } else {
      dayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      dayEvents.forEach(e => {
        const start = new Date(e.start);
        const end = new Date(e.end);
        const timeStr = `${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        html += `
          <div class="day-event-item" style="border-left: 4px solid ${e.color || '#3788d8'}; padding: 8px; margin-bottom: 6px; background: #2a2a3a; border-radius: 4px; cursor: pointer;" data-id="${e.id}">
            <strong>${e.title}</strong><br>
            <small class="text-muted">${timeStr}</small>
            ${e.description ? `<br><small>${e.description}</small>` : ''}
          </div>
        `;
      });
    }
    html += `</div>`;
    grid.innerHTML = html;

    // Click en evento para editar
    document.querySelectorAll('.day-event-item').forEach(el => {
      el.addEventListener('click', function() {
        const id = parseInt(this.dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== VISTA SEMANA ==========
  function renderWeekView() {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Domingo
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    viewTitle.textContent = `${startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    let html = `<div class="week-grid">`;
    // Cabecera con días
    html += `<div class="week-header">`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
      html += `<div class="week-day-header ${isToday ? 'today' : ''}">${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</div>`;
    }
    html += `</div>`;

    // Cuerpo: eventos por día
    html += `<div class="week-body">`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      html += `<div class="week-day-col" data-date="${dateStr}">`;
      if (dayEvents.length === 0) {
        html += `<div class="week-day-empty">Sin eventos</div>`;
      } else {
        dayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
        dayEvents.forEach(e => {
          const start = new Date(e.start);
          const timeStr = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          html += `
            <div class="week-event-item" style="border-left: 4px solid ${e.color || '#3788d8'}; padding: 4px 6px; margin-bottom: 4px; background: #2a2a3a; border-radius: 3px; cursor: pointer; font-size: 0.85rem;" data-id="${e.id}">
              <strong>${e.title}</strong> <small class="text-muted">${timeStr}</small>
            </div>
          `;
        });
      }
      html += `</div>`;
    }
    html += `</div></div>`;
    grid.innerHTML = html;

    // Click en columna para crear evento
    document.querySelectorAll('.week-day-col').forEach(col => {
      col.addEventListener('click', function(e) {
        if (e.target === this || e.target.classList.contains('week-day-empty')) {
          const date = this.dataset.date;
          openCreateModal(date);
        }
      });
    });
    // Click en evento para editar
    document.querySelectorAll('.week-event-item').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        openEditModal(id);
      });
    });
  }

  // ========== VISTA MES (LA QUE YA TENÍAS) ==========
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
        html += `<div class="day-dots">`;
        dayEvents.slice(0, 3).forEach(e => {
          html += `<span class="dot" style="background-color: ${e.color || '#3788d8'}"></span>`;
        });
        if (dayEvents.length > 3) html += `<span class="dot-more">+${dayEvents.length - 3}</span>`;
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
        // Al hacer clic en un día, cambiar a vista día
        currentDate = new Date(date);
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
      // Días en miniatura (solo números con puntos)
      const miniDays = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, m, d);
        const dateStr = dateObj.toISOString().split('T')[0];
        const hasEvent = events.some(e => e.start.startsWith(dateStr));
        miniDays.push(`<span class="year-day ${hasEvent ? 'has-event' : ''}" data-date="${dateStr}">${d}</span>`);
      }
      html += miniDays.join(' ');
      html += `</div></div>`;
    }
    html += `</div>`;
    grid.innerHTML = html;

    // Click en un mes para cambiar a vista mes
    document.querySelectorAll('.year-month').forEach(el => {
      el.addEventListener('click', function() {
        const month = parseInt(this.dataset.month);
        currentDate = new Date(year, month, 1);
        currentView = 'month';
        updateViewButtons();
        renderView();
      });
    });
    // Click en un día para cambiar a vista día
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

  // ========== LISTA DE EVENTOS (SIDEBAR) ==========
  function renderEventList() {
    if (!eventListEl) return;
    if (events.length === 0) {
      eventListEl.innerHTML = '<div class="text-muted small p-2">No hay eventos</div>';
      return;
    }
    const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
    let html = '';
    sorted.forEach(ev => {
      const startDate = new Date(ev.start);
      const dateStr = startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      html += `
        <div class="list-group-item" data-id="${ev.id}">
          <span class="event-title" style="border-left: 4px solid ${ev.color || '#3788d8'}; padding-left: 8px;">
            <strong>${ev.title}</strong><br>
            <small class="text-muted">${dateStr}</small>
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

  // ========== MODAL: CREAR / EDITAR ==========
  function openCreateModal(dateStr) {
    modalTitle.textContent = 'Nuevo evento';
    eventIdInput.value = '';
    form.reset();
    colorInput.value = '#3788d8';
    deleteBtn.style.display = 'none';
    currentEventId = null;

    if (dateStr) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
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
      const ev = events.find(e => e.id === id);
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

    if (!title || !start || !end) {
      alert('Título, inicio y fin son obligatorios');
      return;
    }

    const payload = { title, description, start, end, allDay, color };

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

  // ========== CAMBIO DE VISTA ==========
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
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  viewBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      setView(this.dataset.view);
    });
  });

  newEventBtn.addEventListener('click', () => openCreateModal(null));

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
