document.addEventListener('DOMContentLoaded', () => {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  let calendar = null;
  let holidays = [];

  // Obtener festivos
  fetch('/api/holidays')
    .then(res => res.json())
    .then(data => {
      holidays = data.map(h => ({
        ...h,
        start: h.date,
        end: h.date,
        allDay: true,
        display: 'background', // fondo gris claro
        color: '#e8e8e8',
        textColor: '#666',
        editable: false,
        eventDisplay: 'block'
      }));
      initCalendar();
    })
    .catch(() => initCalendar());

  function initCalendar() {
    // Obtener eventos del usuario
    fetch('/api/events')
      .then(res => res.json())
      .then(events => {
        // Combinar eventos del usuario + festivos
        const allEvents = [
          ...events.map(e => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            color: e.color || '#3788d8',
            allDay: e.all_day === 1,
            description: e.description || ''
          })),
          ...holidays
        ];

        calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          locale: 'es',
          headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          },
          events: allEvents,
          editable: true,
          selectable: true,
          selectMirror: true,
          dayMaxEvents: true,
          eventColor: '#1a3a4a',
          eventClick: handleEventClick,
          select: handleDateSelect,
          eventDrop: handleEventDrop,
          eventResize: handleEventResize,
          eventDidMount: (info) => {
            // Marcar festivos con estilo especial
            if (info.event.extendedProps.isHoliday) {
              info.el.style.opacity = '0.6';
              info.el.style.border = '1px dashed #999';
            }
          }
        });

        calendar.render();
      })
      .catch(err => console.error('Error cargando eventos:', err));
  }

  // Funciones de manejo de eventos
  function handleEventClick(info) {
    if (info.event.extendedProps.isHoliday) {
      alert('Este es un festivo nacional, no se puede editar.');
      return;
    }
    const event = info.event;
    const newTitle = prompt('Título del evento:', event.title);
    if (newTitle === null) return;
    const newColor = prompt('Color (hex, ej: #ff0000):', event.backgroundColor) || '#3788d8';
    const newDescription = prompt('Descripción:', event.extendedProps.description || '');

    fetch(`/api/events/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: newDescription,
        start: event.startStr,
        end: event.endStr,
        color: newColor,
        all_day: event.allDay
      })
    })
    .then(res => res.json())
    .then(updated => {
      // Refrescar el calendario
      calendar.refetchEvents();
    })
    .catch(err => alert('Error al actualizar: ' + err.message));
  }

  function handleDateSelect(info) {
    const title = prompt('Título del nuevo evento:');
    if (!title) return;
    const color = prompt('Color (hex, ej: #3788d8):', '#3788d8') || '#3788d8';
    const description = prompt('Descripción (opcional):', '');
    const start = info.startStr;
    const end = info.endStr;

    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        start,
        end,
        color,
        all_day: info.allDay
      })
    })
    .then(res => res.json())
    .then(() => {
      calendar.refetchEvents();
    })
    .catch(err => alert('Error al crear evento: ' + err.message));
  }

  function handleEventDrop(info) {
    const event = info.event;
    fetch(`/api/events/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: event.title,
        description: event.extendedProps.description || '',
        start: event.startStr,
        end: event.endStr,
        color: event.backgroundColor,
        all_day: event.allDay
      })
    })
    .then(res => res.json())
    .then(() => calendar.refetchEvents())
    .catch(err => {
      alert('Error al mover evento: ' + err.message);
      calendar.refetchEvents(); // revertir
    });
  }

  function handleEventResize(info) {
    const event = info.event;
    fetch(`/api/events/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: event.title,
        description: event.extendedProps.description || '',
        start: event.startStr,
        end: event.endStr,
        color: event.backgroundColor,
        all_day: event.allDay
      })
    })
    .then(res => res.json())
    .then(() => calendar.refetchEvents())
    .catch(err => {
      alert('Error al redimensionar: ' + err.message);
      calendar.refetchEvents();
    });
  }
});
