var API = (function () {
  var BASE = '/api';

  function authHeader() {
    var token = Storage.obtenerToken();
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
                 : { 'Content-Type': 'application/json' };
  }

  // ── Modo Libre ──

  function crearProyecto(usuario, nombre) {
    return fetch(BASE + '/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usuario, nombre: nombre })
    }).then(function (r) { return r.json(); });
  }

  function unirseProyecto(id, usuario, nombre) {
    return fetch(BASE + '/proyectos/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, usuario: usuario, nombre: nombre })
    }).then(function (r) { return r.json(); });
  }

  function obtenerProyecto(id) {
    return fetch(BASE + '/proyectos/' + id).then(function (r) { return r.json(); });
  }

  function agregarRendicion(idProyecto, datos) {
    return fetch(BASE + '/proyectos/' + idProyecto + '/rendiciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    }).then(function (r) { return r.json(); });
  }

  function urlExcel(idProyecto) {
    return BASE + '/proyectos/' + idProyecto + '/excel';
  }

  // ── Modo Ejecutivo: Auth ──

  function register(email, password, rol) {
    return fetch(BASE + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, rol: rol })
    }).then(function (r) { return r.json(); });
  }

  function login(email, password) {
    return fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) { return r.json(); });
  }

  function logout() {
    return fetch(BASE + '/auth/logout', {
      method: 'POST',
      headers: authHeader()
    }).then(function (r) { return r.json(); });
  }

  function me() {
    return fetch(BASE + '/auth/me', {
      headers: authHeader()
    }).then(function (r) { return r.json(); });
  }

  // ── Modo Ejecutivo: Rendiciones ──

  function crearRendicionEjecutiva(tipo, nombre, fecha, monto_total) {
    return fetch(BASE + '/rendiciones', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ tipo: tipo, nombre: nombre, fecha: fecha, monto_total: monto_total })
    }).then(function (r) { return r.json(); });
  }

  function listarRendiciones(estado) {
    var url = BASE + '/rendiciones';
    if (estado) url += '?estado=' + encodeURIComponent(estado);
    return fetch(url, { headers: authHeader() }).then(function (r) { return r.json(); });
  }

  function obtenerRendicion(id) {
    return fetch(BASE + '/rendiciones/' + id, { headers: authHeader() }).then(function (r) { return r.json(); });
  }

  function cerrarRendicion(id) {
    return fetch(BASE + '/rendiciones/' + id + '/cerrar', {
      method: 'PUT',
      headers: authHeader()
    }).then(function (r) { return r.json(); });
  }

  // ── Modo Ejecutivo: Detalles ──

  function agregarDetalle(rendicionId, datos) {
    return fetch(BASE + '/rendiciones/' + rendicionId + '/detalles', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify(datos)
    }).then(function (r) { return r.json(); });
  }

  function actualizarDetalle(rendicionId, detalleId, datos) {
    return fetch(BASE + '/rendiciones/' + rendicionId + '/detalles/' + detalleId, {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify(datos)
    }).then(function (r) { return r.json(); });
  }

  function eliminarDetalle(rendicionId, detalleId) {
    return fetch(BASE + '/rendiciones/' + rendicionId + '/detalles/' + detalleId, {
      method: 'DELETE',
      headers: authHeader()
    }).then(function (r) { return r.json(); });
  }

  // ── Modo Ejecutivo: Contador ──

  function vincularTrabajador(codigo) {
    return fetch(BASE + '/vincular', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ codigo: codigo })
    }).then(function (r) { return r.json(); });
  }

  function listarTrabajadores() {
    return fetch(BASE + '/contador/trabajadores', { headers: authHeader() }).then(function (r) { return r.json(); });
  }

  // ── Modo Ejecutivo: Centros de Costo ──

  function listarCentrosCosto() {
    return fetch(BASE + '/centros-costo', { headers: authHeader() }).then(function (r) { return r.json(); });
  }

  function crearCentroCosto(codigo, nombre) {
    return fetch(BASE + '/centros-costo', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ codigo: codigo, nombre: nombre })
    }).then(function (r) { return r.json(); });
  }

  function eliminarCentroCosto(id) {
    return fetch(BASE + '/centros-costo/' + id, {
      method: 'DELETE',
      headers: authHeader()
    }).then(function (r) { return r.json(); });
  }

  function asignarCentroCosto(rendicionId, detalleId, centroCostoId) {
    return fetch(BASE + '/rendiciones/' + rendicionId + '/detalles/' + detalleId + '/centro-costo', {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify({ centro_costo_id: centroCostoId })
    }).then(function (r) { return r.json(); });
  }

  // ── Modo Ejecutivo: Excel Contable y Envio ──

  function descargarExcelContable(rendicionId) {
    return fetch(BASE + '/rendiciones/' + rendicionId + '/excel', {
      headers: authHeader()
    }).then(function (r) {
      if (!r.ok) return r.json();
      return r.blob();
    });
  }

  function enviarRendicionCorreo(rendicionId, email) {
    return fetch(BASE + '/rendiciones/' + rendicionId + '/enviar', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ email: email })
    }).then(function (r) { return r.json(); });
  }

  return {
    crearProyecto: crearProyecto,
    unirseProyecto: unirseProyecto,
    obtenerProyecto: obtenerProyecto,
    agregarRendicion: agregarRendicion,
    urlExcel: urlExcel,

    register: register,
    login: login,
    logout: logout,
    me: me,

    crearRendicionEjecutiva: crearRendicionEjecutiva,
    listarRendiciones: listarRendiciones,
    obtenerRendicion: obtenerRendicion,
    cerrarRendicion: cerrarRendicion,

    agregarDetalle: agregarDetalle,
    actualizarDetalle: actualizarDetalle,
    eliminarDetalle: eliminarDetalle,

    vincularTrabajador: vincularTrabajador,
    listarTrabajadores: listarTrabajadores,

    listarCentrosCosto: listarCentrosCosto,
    crearCentroCosto: crearCentroCosto,
    eliminarCentroCosto: eliminarCentroCosto,
    asignarCentroCosto: asignarCentroCosto,

    descargarExcelContable: descargarExcelContable,
    enviarRendicionCorreo: enviarRendicionCorreo
  };
})();
