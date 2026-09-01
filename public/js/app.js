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
  const categoriasBtn = $('#categoriasBtn');
  const eventListEl = $('#eventList');
  const finishedListEl = $('#finishedEventsList');

  // Modales
  const settingsModal = new bootstrap.Modal($('#settingsModal'));
  const categoriasModal = new bootstrap.Modal($('#categoriasModal'));
  const modalEvent = new bootstrap.Modal($('#eventModal'));

  // Elementos configuración
  const timeFormatSelect = $('#timeFormatSelect');
  const themeSelect = $('#themeSelect');
  const saveSettingsBtn = $('#saveSettingsBtn');

  // Elementos categorías
  const categoriasList = $('#categoriasList');
  const categoriaForm = $('#categoriaForm');
  const categoriaEditId = $('#categoriaEditId');
  const categoriaNombre = $('#categoriaNombre');
  const categoriaColor = $('#categoriaColor');
  const categoriaSaveBtn = $('#categoriaSaveBtn');
  const categoriaError = $('#categoriaError');

  // Elementos evento
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

  // ========== PREFERENCIAS ==========
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
          <span class="event-title" style="border-left: 4px solid ${color}; padding-left: 8px;" title="${ev.title} - ${timeStr}">
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
          <span class="event-title" style="border-left: 4px solid ${color}; padding-left: 8px;" title="${ev.title} - ${timeStr}">
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
