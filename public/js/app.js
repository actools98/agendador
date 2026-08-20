document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');
  const eventListEl = document.getElementById('eventList');
  const modal = new bootstrap.Modal(document.getElementById('eventModal'));
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
  const newEventBtn = document.getElementById('newEventBtn');

  let currentEventId = null;
  let calendar = null;

  // Función para cargar eventos y actualizar lista
  async function loadEvents() {
    try {
      const res = await fetch('/api/events');
      const events = await res.json();
      // Actualizar calendario
      if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(events.map(e => ({
          id: String(e.id),
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.all_day === 1,
          color: e.color || '#3788d8',
          description: e.description
        })));
      }
      // Actualizar lista lateral
      renderEventList(events);
    } catch (error) {
      console.error('Error cargando eventos:', error);
    }
  }

  // Renderizar lista de eventos en la columna izquierda
  function renderEventList(events) {
    if (!eventListEl) return;
    if (events.length === 0) {
      eventListEl.innerHTML = '<div class="text-muted small p-2">No hay eventos</div>';
      return;
    }
    const sorted = events.sort((a, b) => new Date(a.start) - new Date(b.start));
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

    // Event listeners para editar/eliminar desde la lista
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
    // Al hacer clic en el título del evento, abrir edición
    document.querySelectorAll('.event-title').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.closest('.list-group-item').dataset.id);
        openEditModal(id);
      });
    });
  }

  // Abrir modal para crear nuevo evento (fecha sugerida)
  function openCreateModal(startDate, endDate) {
    modalTitle.textContent = 'Nuevo evento';
    eventIdInput.value = '';
    form.reset();
    colorInput.value = '#3788d8';
    deleteBtn.style.display = 'none';
    currentEventId = null;

    // Si se pasa startDate, ajustar campos
    if (startDate) {
      const start = new Date(startDate);
      // Redondear a la hora actual o al siguiente bloque de 30 minutos
      start.setMinutes(0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      const formatLocal = (date) => {
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
      };
      startInput.value = formatLocal(start);
      endInput.value = formatLocal(end);
    } else {
      // Por defecto: ahora + 1 hora
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const later = new Date(now);
      later.setHours(later.getHours() + 1);
      const formatLocal = (date) => {
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
      };
      startInput.value = formatLocal(now);
      endInput.value = formatLocal(later);
    }

    allDayInput.checked = false;
    modal.show();
  }

  // Abrir modal para editar evento existente
  async function openEditModal(id) {
    try {
      const res = await fetch(`/api/events`);
      const events = await res.json();
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

  // Guardar evento (crear o actualizar)
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
        loadEvents(); // Recargar
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
        loadEvents();
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

  // Inicializar FullCalendar
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listMonth'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      list: 'Lista'
    },
    events: [], // Se cargarán dinámicamente
    dateClick: function(info) {
      openCreateModal(info.dateStr);
    },
    eventClick: function(info) {
      const id = parseInt(info.event.id);
      openEditModal(id);
    },
    eventDrop: function(info) {
      // Al arrastrar, actualizar fechas
      const event = info.event;
      const id = parseInt(event.id);
      const payload = {
        title: event.title,
        description: event.extendedProps.description || '',
        start: event.start.toISOString(),
        end: event.end ? event.end.toISOString() : event.start.toISOString(),
        allDay: event.allDay,
        color: event.backgroundColor || '#3788d8'
      };
      fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => {
        if (!res.ok) console.error('Error al actualizar por arrastre');
        loadEvents(); // recargar para sincronizar lista
      }).catch(console.error);
    },
    eventResize: function(info) {
      // Similar a eventDrop
      const event = info.event;
      const id = parseInt(event.id);
      const payload = {
        title: event.title,
        description: event.extendedProps.description || '',
        start: event.start.toISOString(),
        end: event.end ? event.end.toISOString() : event.start.toISOString(),
        allDay: event.allDay,
        color: event.backgroundColor || '#3788d8'
      };
      fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => {
        if (!res.ok) console.error('Error al actualizar por redimension');
        loadEvents();
      }).catch(console.error);
    }
  });

  calendar.render();

  // Cargar eventos al inicio
  loadEvents();

  // Event listeners del modal
  newEventBtn.addEventListener('click', () => openCreateModal());
  saveBtn.addEventListener('click', saveEvent);
  deleteBtn.addEventListener('click', () => {
    if (currentEventId && confirm('¿Eliminar este evento?')) {
      deleteEvent(currentEventId);
    }
  });

  // Al cerrar el modal, limpiar
  document.getElementById('eventModal').addEventListener('hidden.bs.modal', function () {
    currentEventId = null;
    deleteBtn.style.display = 'none';
  });
});
