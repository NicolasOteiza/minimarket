async function logoutToLogin({ preserveShift } = { preserveShift: true }) {
  const logoutMsg = document.getElementById('logout-msg');
  if (logoutMsg) logoutMsg.style.display = 'block';

  const refreshToken = String(sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token') || '').trim();
  if (refreshToken) {
    try {
      await fetch((typeof API_URL !== 'undefined' ? API_URL : '') + 'api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (_) {}
  }

  try {
    localStorage.setItem('estado_login', '0');
    await deleteConnectedUser();
    await updateUser();
  } catch (_) {
  }

  sessionStorage.removeItem('token');
  localStorage.removeItem('token');
  sessionStorage.removeItem('refresh_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('id_user');
  localStorage.removeItem('username');
  localStorage.removeItem('user');
  localStorage.removeItem('estado_login');
  localStorage.removeItem('user_permissions');
  localStorage.removeItem('user_is_admin');
  localStorage.removeItem('password');

  if (!preserveShift) {
    localStorage.removeItem('turno_id_actual');
    localStorage.removeItem('turno_monto_inicial');
    localStorage.removeItem('ticket_seed_shift_id');
    localStorage.removeItem('turno_owner_user');
    localStorage.removeItem('turno_owner_caja');
  }

  window.location.href = 'index.php';
}

document.getElementById('logout').addEventListener('click', async () => {
  const turnoActivo = Boolean(localStorage.getItem('turno_id_actual'));
  if (!turnoActivo) {
    const confirmExit = (typeof window.appConfirm === 'function')
      ? await window.appConfirm('Deseas salir del sistema?', 'warning', {
        title: 'Salir del sistema',
        okText: 'Salir',
        cancelText: 'Cancelar',
      })
      : window.confirm('Deseas salir del sistema?');
    if (!confirmExit) return;
    await logoutToLogin({ preserveShift: false });
    return;
  }

  const ventasEnTurno = (typeof localShiftHasSales === 'function') ? localShiftHasSales() : false;
  if (ventasEnTurno) {
    alert('No puedes salir con el turno abierto porque ya registraste ventas. Debes cerrar turno.');
    const cutBtn = document.getElementById('nav-cut-btn');
    if (cutBtn && !cutBtn.disabled) {
      cutBtn.click();
    }
    return;
  }

  const closeShiftFirst = (typeof window.appConfirm === 'function')
    ? await window.appConfirm(
      'Tienes un turno abierto.\nAceptar: cerrar turno y salir.\nCancelar: dejar turno abierto y salir al login.',
      'warning',
      {
        title: 'Turno abierto',
        okText: 'Cerrar turno y salir',
        cancelText: 'Dejar turno abierto',
      }
    )
    : window.confirm(
      'Tienes un turno abierto.\nAceptar: cerrar turno y salir.\nCancelar: dejar turno abierto y salir al login.'
    );

  if (closeShiftFirst) {
    const declaredInput = (typeof window.appPrompt === 'function')
      ? await window.appPrompt(
        'Ingresa el monto de efectivo declarado para cerrar turno:',
        '0',
        {
          title: 'Cerrar turno',
          okText: 'Cerrar turno',
          cancelText: 'Cancelar',
          placeholder: 'Ejemplo: 20000',
        }
      )
      : window.prompt('Ingresa el monto de efectivo declarado para cerrar turno:', '0');
    if (declaredInput === null) return;
    const declaredAmount = Number(String(declaredInput).trim());
    if (!Number.isFinite(declaredAmount) || declaredAmount < 0) {
      alert('Monto declarado inválido.');
      return;
    }
    if (typeof closeCurrentShift === 'function') {
      await closeCurrentShift(declaredAmount);
    }
    return;
  }

  await logoutToLogin({ preserveShift: true });
});
