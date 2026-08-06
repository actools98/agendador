const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const formTitle = document.getElementById('formTitle');
const switchText = document.getElementById('switchText');
const switchAction = document.getElementById('switchAction');
const messageDiv = document.getElementById('message');

let isLogin = true;

function toggleForm() {
  isLogin = !isLogin;
  formTitle.textContent = isLogin ? 'Iniciar Sesión' : 'Registrarse';
  submitBtn.textContent = isLogin ? 'Ingresar' : 'Registrarse';
  switchText.textContent = isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
  switchAction.textContent = isLogin ? 'Regístrate' : 'Inicia sesión';
  messageDiv.textContent = '';
  messageDiv.className = 'message';
}

switchAction.addEventListener('click', toggleForm);

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !password) {
    messageDiv.textContent = 'Completa todos los campos';
    messageDiv.className = 'message';
    return;
  }

  const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      if (isLogin) {
        window.location.href = '/dashboard.html';
      } else {
        messageDiv.textContent = '¡Registro exitoso! Ahora inicia sesión.';
        messageDiv.className = 'message success-message';
        toggleForm();
        usernameInput.value = '';
        passwordInput.value = '';
      }
    } else {
      messageDiv.textContent = data.error || 'Error en la solicitud';
      messageDiv.className = 'message';
    }
  } catch (err) {
    messageDiv.textContent = 'Error de conexión';
    messageDiv.className = 'message';
  }
});

// Redirigir si ya está autenticado
(async () => {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      window.location.href = '/dashboard.html';
    }
  } catch (_) {}
})();
