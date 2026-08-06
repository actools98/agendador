document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  fetch('/api/auth/me')
    .then(res => {
      if (!res.ok) {
        window.location.href = '/';
        return;
      }
      return res.json();
    })
    .then(user => {
      if (user) {
        // Cargar vista por defecto: calendario
        loadView('calendar');
      }
    })
    .catch(() => window.location.href = '/');

  // Manejo de menú
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const view = item.dataset.view;
      loadView(view);
    });
  });

  // Cerrar sesión
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout');
    window.location.href = '/';
  });

  function loadView(view) {
    const container = document.getElementById('viewContent');
    if (view === 'calendar') {
      // Cargar la vista del calendario (HTML + JS)
      fetch('/views/calendar.html')
        .then(res => res.text())
        .then(html => {
          container.innerHTML = html;
          // Ejecutar el script de calendar.js después de cargar el HTML
          const script = document.createElement('script');
          script.src = '/js/calendar.js';
          document.body.appendChild(script);
        });
    } else {
      // Placeholder para otras vistas
      container.innerHTML = `
        <div class="view-title">${view.charAt(0).toUpperCase() + view.slice(1)}</div>
        <div class="placeholder">Próximamente...</div>
      `;
    }
  }
});
