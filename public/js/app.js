document.addEventListener('DOMContentLoaded', function() {
  // Estado
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth();
  let events = [];
  let selectedDate = null;

  // Elementos
  const grid = document.getElementById('calendarGrid');
  const monthYear = document.getElementById('currentMonthYear');
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');
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

  // Cargar eventos desde el servidor
  async function loadEventsFromServer() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Error al cargar eventos');
      events = await res.json();
      renderCalendar();
      renderEventList();
    } catch (error) {
      console.error('Error cargando eventos:', error);
    }
  }

  // Renderizar el calendario
  function renderCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0=domingo

    // Actualizar título
    monthYear.textContent = `${firstDay.toLocaleString('es', { month: 'long' })} ${currentYear}`;

    // Construir grid
    let html = '<div class="calendar-weekdays">';
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    weekdays.forEach(day => html += `<div class="weekday">${day}</div>`);
    html += '</div><div class="calendar-days">';

    // Días vacíos al inicio
    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="day empty"></div>';
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(currentYear, currentMonth, day);
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

    // Completar última semana
    const totalCells = startDayOfWeek + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remaining; i++) {
      html += '<div class="day empty"></div>';
    }

    html += '</div>';
    grid.innerHTML = html;

    // Event listeners en días
    document.querySelectorAll('.day:not(.empty)').forEach(el => {
      el.addEventListener('click', function() {
        const date = this.dataset.date;
        openCreateModal(date);
      });
    });
  }

  // Renderizar lista de eventos en sidebar
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

    // Listeners
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

  // Abrir modal para nuevo evento (con fecha sugerida)
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

  // Abrir modal para editar evento
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

  // Guardar evento
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

  // Eliminar evento
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

  // Navegación meses
  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  }

  // Event listeners
  prevBtn.addEventListener('click', prevMonth);
  nextBtn.addEventListener('click', nextMonth);
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

  // Inicializar
  loadEventsFromServer();
});
