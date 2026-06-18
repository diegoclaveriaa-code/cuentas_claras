var API = (function () {
  var BASE = '/api';

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

  return {
    crearProyecto: crearProyecto,
    unirseProyecto: unirseProyecto,
    obtenerProyecto: obtenerProyecto,
    agregarRendicion: agregarRendicion,
    urlExcel: urlExcel
  };
})();
