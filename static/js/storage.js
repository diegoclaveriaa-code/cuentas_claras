var Storage = (function () {
  var KEY_ACTIVO = 'cuentasclaras_activo';
  var KEY_USUARIO = 'cuentasclaras_usuario';
  var KEY_PROYECTO = 'cuentasclaras_proyecto';

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

  return {
    guardarSesion: guardarSesion,
    limpiarSesion: limpiarSesion,
    estaLogueado: estaLogueado,
    obtenerIdProyecto: obtenerIdProyecto,
    obtenerUsuario: obtenerUsuario,
    obtenerProyecto: obtenerProyecto
  };
})();
