var Storage = (function () {
  var KEY_ACTIVO = 'cuentasclaras_activo';
  var KEY_USUARIO = 'cuentasclaras_usuario';
  var KEY_PROYECTO = 'cuentasclaras_proyecto';

  // Keys for executive mode
  var KEY_MODO = 'cuentasclaras_modo';
  var KEY_TOKEN = 'cuentasclaras_token';
  var KEY_USER_ID = 'cuentasclaras_user_id';
  var KEY_USER_EMAIL = 'cuentasclaras_user_email';
  var KEY_USER_ROL = 'cuentasclaras_user_rol';
  var KEY_CODIGO_TRABAJADOR = 'cuentasclaras_codigo_trab';

  function guardarSesion(id, usuario, proyecto) {
    localStorage.setItem(KEY_ACTIVO, id);
    localStorage.setItem(KEY_USUARIO, usuario);
    localStorage.setItem(KEY_PROYECTO, proyecto);
  }

  function limpiarSesion() {
    localStorage.removeItem(KEY_ACTIVO);
    localStorage.removeItem(KEY_USUARIO);
    localStorage.removeItem(KEY_PROYECTO);
  }

  function estaLogueado() {
    return localStorage.getItem(KEY_ACTIVO) !== null;
  }

  function obtenerIdProyecto() {
    return localStorage.getItem(KEY_ACTIVO);
  }

  function obtenerUsuario() {
    return localStorage.getItem(KEY_USUARIO);
  }

  function obtenerProyecto() {
    return localStorage.getItem(KEY_PROYECTO);
  }

  // ── Executive mode ──

  function guardarModo(modo) {
    localStorage.setItem(KEY_MODO, modo);
  }

  function obtenerModo() {
    return localStorage.getItem(KEY_MODO);
  }

  function limpiarModo() {
    localStorage.removeItem(KEY_MODO);
  }

  function guardarSesionEjecutiva(token, userData) {
    localStorage.setItem(KEY_MODO, 'ejecutivo');
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_USER_ID, userData.id);
    localStorage.setItem(KEY_USER_EMAIL, userData.email);
    localStorage.setItem(KEY_USER_ROL, userData.rol);
    if (userData.codigo_trabajador) {
      localStorage.setItem(KEY_CODIGO_TRABAJADOR, userData.codigo_trabajador);
    } else {
      localStorage.removeItem(KEY_CODIGO_TRABAJADOR);
    }
  }

  function limpiarSesionEjecutiva() {
    localStorage.removeItem(KEY_MODO);
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER_ID);
    localStorage.removeItem(KEY_USER_EMAIL);
    localStorage.removeItem(KEY_USER_ROL);
    localStorage.removeItem(KEY_CODIGO_TRABAJADOR);
  }

  function estaLogueadoEjecutivo() {
    return localStorage.getItem(KEY_TOKEN) !== null;
  }

  function obtenerToken() {
    return localStorage.getItem(KEY_TOKEN);
  }

  function obtenerUserEmail() {
    return localStorage.getItem(KEY_USER_EMAIL);
  }

  function obtenerUserRol() {
    return localStorage.getItem(KEY_USER_ROL);
  }

  function obtenerUserId() {
    return localStorage.getItem(KEY_USER_ID);
  }

  function obtenerCodigoTrabajador() {
    return localStorage.getItem(KEY_CODIGO_TRABAJADOR);
  }

  return {
    guardarSesion: guardarSesion,
    limpiarSesion: limpiarSesion,
    estaLogueado: estaLogueado,
    obtenerIdProyecto: obtenerIdProyecto,
    obtenerUsuario: obtenerUsuario,
    obtenerProyecto: obtenerProyecto,

    guardarModo: guardarModo,
    obtenerModo: obtenerModo,
    limpiarModo: limpiarModo,

    guardarSesionEjecutiva: guardarSesionEjecutiva,
    limpiarSesionEjecutiva: limpiarSesionEjecutiva,
    estaLogueadoEjecutivo: estaLogueadoEjecutivo,
    obtenerToken: obtenerToken,
    obtenerUserEmail: obtenerUserEmail,
    obtenerUserRol: obtenerUserRol,
    obtenerUserId: obtenerUserId,
    obtenerCodigoTrabajador: obtenerCodigoTrabajador
  };
})();

