document.addEventListener('DOMContentLoaded', function () {
  console.log('✅ app.js cargado correctamente');

  // Verificar que todos los elementos existan
  const calendarEl = document.getElementById('calendar');
  const newEventBtn = document.getElementById('newEventBtn');

  if (!calendarEl) {
    console.error('❌ No se encontró el elemento #calendar');
    return;
  }
  if (!newEventBtn) {
    console.error('❌ No se encontró el botón #newEventBtn');
    return;
  }

  // Elementos del modal
  const modalElement = document.getElementById('eventModal');
  if (!modalElement) {
    console.error('❌ No se encontró el modal #eventModal');
    return;
  }
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
  const eventListEl = document.getElementById('eventList');

  let currentEventId = null;
  let calendar = null;

  // ---------- Funciones ----------
  async function loadEvents() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Error al cargar eventos');
      const events = await res.json();
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
      renderEventList(events);
    } catch (error) {
      console.error('❌ Error cargando eventos:', error);
    }
  }

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

  function openCreateModal(startDate, endDate) {
    console.log('📅 Abriendo modal para nuevo evento');
    modalTitle.textContent = 'Nuevo evento';
    eventIdInput.value = '';
    form.reset();
    colorInput.value = '#3788d8';
    deleteBtn.style.display = 'none';
    currentEventId = null;

    const formatLocal = (date) => {
      const offset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - offset * 60000);
      return local.toISOString().slice(0, 16);
    };

    if (startDate) {
      const start = new Date(startDate);
      start.setMinutes(0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      startInput.value = formatLocal(start);
      endInput.value = formatLocal(end);
    } else {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const later = new Date(now);
      later.setHours(later.getHours() + 1);
      startInput.value = formatLocal(now);
      endInput.value = formatLocal(later);
    }

    allDayInput.checked = false;
    modal.show();
  }

  async function openEditModal(id) {
    try {
      const res = await fetch('/api/events');
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
      console.error('❌ Error al cargar evento para editar:', error);
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
        loadEvents();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'desconocido'));
      }
    } catch (error) {
      console.error('❌ Error al guardar evento:', error);
      alert('Error al guardar');
    }
  }

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
      console.error('❌ Error al eliminar:', error);
      alert('Error al eliminar');
    }
  }

  // ---------- Inicializar FullCalendar ----------
  console.log('🔄 Inicializando FullCalendar...');
  try {
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
      events: [],
      dateClick: function(info) {
        openCreateModal(info.dateStr);
      },
      eventClick: function(info) {
        const id = parseInt(info.event.id);
        openEditModal(id);
      },
      eventDrop: function(info) {
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
          if (!res.ok) console.error('❌ Error al actualizar por arrastre');
          loadEvents();
        }).catch(console.error);
      },
      eventResize: function(info) {
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
          if (!res.ok) console.error('❌ Error al actualizar por redimension');
          loadEvents();
        }).catch(console.error);
      }
    });

    calendar.render();
    console.log('✅ FullCalendar renderizado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar FullCalendar:', error);
  }

  // Cargar eventos iniciales
  loadEvents();

  // ---------- Event Listeners ----------
  // Botón Nuevo Evento
  newEventBtn.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('🖱️ Click en botón Nuevo Evento');
    openCreateModal();
  });

  // Guardar
  saveBtn.addEventListener('click', saveEvent);

  // Eliminar (desde el modal)
  deleteBtn.addEventListener('click', function() {
    if (currentEventId && confirm('¿Eliminar este evento?')) {
      deleteEvent(currentEventId);
    }
  });

  // Al cerrar modal, limpiar
  modalElement.addEventListener('hidden.bs.modal', function () {
    currentEventId = null;
    deleteBtn.style.display = 'none';
  });

  console.log('✅ Todos los eventos configurados correctamente');
});
