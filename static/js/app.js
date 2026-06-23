(function () {
  'use strict';

  var vistas = {
    modo: document.getElementById('view-modo'),
    login: document.getElementById('view-login'),
    registroUsuario: document.getElementById('view-registro-usuario'),
    dashboardEjecutivo: document.getElementById('view-dashboard-ejecutivo'),
    dashboardContador: document.getElementById('view-dashboard-contador'),
    nuevaRendicion: document.getElementById('view-nueva-rendicion'),
    listaRendiciones: document.getElementById('view-lista-rendiciones'),
    detalleRendicion: document.getElementById('view-detalle-rendicion'),
    detalleContador: document.getElementById('view-detalle-contador'),
    registro: document.getElementById('view-registro'),
    dashboard: document.getElementById('view-dashboard'),
    subir: document.getElementById('view-subir'),
    resultado: document.getElementById('view-resultado')
  };

  var imagenSeleccionada = null;
  var resultadoOCR = null;

  // ── Estado ejecutivo ──
  var rendicionActual = null;
  var tipoRendicionSeleccionado = null;
  var origenOCR = null; // 'libre' | 'ejecutivo-boleta' | 'ejecutivo-factura' | 'ejecutivo-devolucion'

  function init() {
    // Determinar estado inicial
    var modo = Storage.obtenerModo();
    if (modo === 'libre') {
      if (Storage.estaLogueado()) {
        mostrarVista('dashboard');
        cargarDashboard();
      } else {
        mostrarVista('registro');
      }
    } else if (modo === 'ejecutivo') {
      if (Storage.estaLogueadoEjecutivo()) {
        var rol = Storage.obtenerUserRol();
        if (rol === 'contador') {
          mostrarVista('dashboardContador');
          cargarDashboardContador();
        } else {
          mostrarVista('dashboardEjecutivo');
          cargarDashboardEjecutivo();
        }
      } else {
        mostrarVista('login');
      }
    } else {
      mostrarVista('modo');
    }

    bindEventos();
  }

  function mostrarVista(nombre) {
    Object.keys(vistas).forEach(function (k) { vistas[k].classList.add('hidden'); });
    vistas[nombre].classList.remove('hidden');
  }

  function toast(mensaje, tipo) {
    var el = document.getElementById('toast');
    el.textContent = mensaje;
    el.className = 'toast ' + (tipo || '');
    el.classList.add('show');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  // ═══════════════════════════════════════════════
  //  BIND ALL EVENTS
  // ═══════════════════════════════════════════════

  function bindEventos() {
    // ── Modo selection ──
    document.getElementById('btn-modo-libre').addEventListener('click', function () {
      Storage.guardarModo('libre');
      mostrarVista('registro');
    });
    document.getElementById('btn-modo-ejecutivo').addEventListener('click', function () {
      Storage.guardarModo('ejecutivo');
      mostrarVista('login');
    });

    // ── Login ──
    document.getElementById('form-login').addEventListener('submit', onLogin);
    document.getElementById('btn-ir-registro').addEventListener('click', function () {
      mostrarVista('registroUsuario');
    });
    document.getElementById('btn-volver-modo-login').addEventListener('click', function () {
      Storage.limpiarModo();
      mostrarVista('modo');
    });

    // ── Registro usuario ──
    document.getElementById('form-registro-usuario').addEventListener('submit', onRegistroUsuario);
    document.getElementById('btn-ir-login').addEventListener('click', function () {
      mostrarVista('login');
    });
    document.getElementById('btn-volver-modo-reg').addEventListener('click', function () {
      mostrarVista('login');
    });

    // ── Dashboard Ejecutivo ──
    document.getElementById('btn-cerrar-sesion').addEventListener('click', onLogout);
    document.getElementById('btn-nueva-rendicion').addEventListener('click', function () {
      tipoRendicionSeleccionado = null;
      document.getElementById('card-tipo-rendicion').classList.remove('hidden');
      document.getElementById('card-form-rendicion').classList.add('hidden');
      mostrarVista('nuevaRendicion');
    });
    document.getElementById('btn-mis-rendiciones').addEventListener('click', function () {
      mostrarListaRendiciones('Mis Rendiciones Activas', 'activa');
    });
    document.getElementById('btn-historial').addEventListener('click', function () {
      mostrarListaRendiciones('Historial de Rendiciones', '');
    });

    // ── Dashboard Contador ──
    document.getElementById('btn-cerrar-sesion-contador').addEventListener('click', onLogout);
    document.getElementById('form-vincular').addEventListener('submit', onVincular);
    document.getElementById('form-centro-costo').addEventListener('submit', onCrearCentroCosto);

    // ── Nueva Rendicion ──
    document.getElementById('btn-tipo-compania').addEventListener('click', function () {
      seleccionarTipoRendicion('compania', 'Dinero entregado por la compania');
    });
    document.getElementById('btn-tipo-restitucion').addEventListener('click', function () {
      seleccionarTipoRendicion('restitucion', 'Restitucion de fondos propios del trabajador');
    });
    document.getElementById('btn-volver-nueva-rendicion').addEventListener('click', function () {
      mostrarVista('dashboardEjecutivo');
    });
    document.getElementById('form-nueva-rendicion').addEventListener('submit', onCrearRendicion);

    // ── Lista Rendiciones ──
    document.getElementById('btn-volver-lista').addEventListener('click', function () {
      var rol = Storage.obtenerUserRol();
      mostrarVista(rol === 'contador' ? 'dashboardContador' : 'dashboardEjecutivo');
    });

    // ── Detalle Rendicion ──
    document.getElementById('btn-volver-detalle').addEventListener('click', function () {
      var rol = Storage.obtenerUserRol();
      mostrarVista(rol === 'contador' ? 'dashboardContador' : 'dashboardEjecutivo');
    });
    document.getElementById('btn-cerrar-rendicion').addEventListener('click', onCerrarRendicion);
    document.getElementById('btn-detalle-boleta').addEventListener('click', function () {
      origenOCR = 'ejecutivo-boleta';
      onNuevaBoleta();
    });
    document.getElementById('btn-detalle-factura').addEventListener('click', function () {
      origenOCR = 'ejecutivo-factura';
      onNuevaBoleta();
    });
    document.getElementById('btn-detalle-devolucion').addEventListener('click', function () {
      origenOCR = 'ejecutivo-devolucion';
      onNuevaBoleta();
    });
    document.getElementById('btn-detalle-manual').addEventListener('click', function () {
      origenOCR = 'ejecutivo-manual';
      abrirFormularioManualEjecutivo();
    });

    // ── Detalle Contador ──
    document.getElementById('btn-volver-detalle-contador').addEventListener('click', function () {
      mostrarVista('dashboardContador');
      cargarDashboardContador();
    });
    document.getElementById('btn-exportar-excel-contador').addEventListener('click', function () {
      onExportarExcel(true);
    });
    document.getElementById('btn-enviar-correo-contador').addEventListener('click', function () {
      onEnviarCorreo(true);
    });

    // ── Exportar / Enviar (trabajador) ──
    document.getElementById('btn-exportar-excel').addEventListener('click', function () {
      onExportarExcel(false);
    });
    document.getElementById('btn-enviar-correo').addEventListener('click', function () {
      onEnviarCorreo(false);
    });

    // ── Modo libre (unchanged events) ──
    document.getElementById('form-registro').addEventListener('submit', onRegistro);
    document.getElementById('form-unirse').addEventListener('submit', onUnirse);
    document.getElementById('btn-ir-dashboard-nuevo').addEventListener('click', onIrDashboardNuevo);
    document.getElementById('btn-cambiar-proyecto').addEventListener('click', onChangeProject);
    document.getElementById('btn-nueva-boleta').addEventListener('click', function () {
      origenOCR = 'libre';
      onNuevaBoleta();
    });
    document.getElementById('btn-manual').addEventListener('click', function () {
      origenOCR = 'libre';
      abrirFormularioManual();
    });
    document.getElementById('btn-exportar').addEventListener('click', onExportar);
    document.getElementById('btn-calcular-split').addEventListener('click', onCalcularSplit);
    document.getElementById('btn-volver-modo').addEventListener('click', function () {
      Storage.limpiarModo();
      Storage.limpiarSesion();
      mostrarVista('modo');
    });

    // ── Subir boleta events ──
    document.getElementById('btn-capturar').addEventListener('click', function () {
      document.getElementById('file-input').click();
    });
    document.getElementById('btn-adjuntar').addEventListener('click', function () {
      document.getElementById('doc-input').click();
    });
    document.getElementById('file-input').addEventListener('change', onFileSelected);
    document.getElementById('doc-input').addEventListener('change', onFileSelected);
    document.getElementById('upload-area').addEventListener('click', function () {
      document.getElementById('file-input').click();
    });
    document.getElementById('btn-procesar').addEventListener('click', onProcesar);
    document.getElementById('btn-otra-foto').addEventListener('click', onOtraFoto);

    document.getElementById('btn-volver-subir').addEventListener('click', function () {
      volverDesdeSubir();
    });

    document.getElementById('btn-ir-manual').addEventListener('click', function () {
      if (origenOCR && origenOCR !== 'libre') {
        origenOCR = 'ejecutivo-manual';
        abrirFormularioManualEjecutivo();
      } else {
        abrirFormularioManual();
      }
    });

    document.getElementById('btn-volver-resultado').addEventListener('click', function () {
      mostrarVista('subir');
      resetSubir();
    });

    document.getElementById('form-resultado').addEventListener('submit', onConfirmar);

    document.getElementById('campo-total').addEventListener('input', function () {
      var total = parseFloat(this.value) || 0;
      if (total > 0) {
        var neto = Math.round(total / 1.19);
        document.getElementById('campo-neto').value = neto;
      }
    });
  }

  // ═══════════════════════════════════════════════
  //  LOGIN / REGISTRO EJECUTIVO
  // ═══════════════════════════════════════════════

  function onLogin(e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value.trim();
    if (!email || !password) { toast('Completa todos los campos', 'error'); return; }

    API.login(email, password).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      Storage.guardarSesionEjecutiva(data.token, data.usuario);
      if (data.usuario.rol === 'contador') {
        mostrarVista('dashboardContador');
        cargarDashboardContador();
      } else {
        mostrarVista('dashboardEjecutivo');
        cargarDashboardEjecutivo();
      }
      toast('Bienvenido, ' + data.usuario.email, 'success');
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  function onRegistroUsuario(e) {
    e.preventDefault();
    var email = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value.trim();
    var rol = document.getElementById('reg-rol').value;
    if (!email || !password || !rol) { toast('Completa todos los campos', 'error'); return; }
    if (password.length < 6) { toast('La contrasena debe tener al menos 6 caracteres', 'error'); return; }

    API.register(email, password, rol).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      toast('Cuenta creada. Ahora inicia sesion.', 'success');
      mostrarVista('login');
      document.getElementById('login-email').value = email;
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  function onLogout() {
    API.logout().then(function () {
      Storage.limpiarSesionEjecutiva();
      Storage.limpiarModo();
      mostrarVista('modo');
    }).catch(function () {
      Storage.limpiarSesionEjecutiva();
      Storage.limpiarModo();
      mostrarVista('modo');
    });
  }

  // ═══════════════════════════════════════════════
  //  DASHBOARD EJECUTIVO
  // ═══════════════════════════════════════════════

  function cargarDashboardEjecutivo() {
    document.getElementById('ejecutivo-email-display').textContent = Storage.obtenerUserEmail();
    var codigo = Storage.obtenerCodigoTrabajador();
    if (codigo) {
      document.getElementById('card-codigo-trabajador').classList.remove('hidden');
      document.getElementById('codigo-trabajador-display').textContent = codigo;
    } else {
      document.getElementById('card-codigo-trabajador').classList.add('hidden');
    }
  }

  // ═══════════════════════════════════════════════
  //  DASHBOARD CONTADOR
  // ═══════════════════════════════════════════════

  function cargarDashboardContador() {
    document.getElementById('contador-email-display').textContent = Storage.obtenerUserEmail();
    API.listarTrabajadores().then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      renderTrabajadores(data);
    }).catch(function () { toast('Error al cargar trabajadores', 'error'); });
    cargarCentrosCosto();
  }

  function cargarCentrosCosto() {
    API.listarCentrosCosto().then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      renderCentrosCosto(data);
    }).catch(function () { toast('Error al cargar centros de costo', 'error'); });
  }

  function renderCentrosCosto(lista) {
    var container = document.getElementById('lista-centros-costo');
    if (!lista || lista.length === 0) {
      container.innerHTML = '<p class="vacio">No hay centros de costo.</p>';
      return;
    }
    container.innerHTML = '';
    lista.forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'rendicion-item';
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      div.innerHTML = '<span><strong>' + escaparHTML(c.codigo || '') + '</strong> - ' + escaparHTML(c.nombre) + '</span>' +
        '<button class="btn btn-sm btn-outline" data-id="' + c.id + '" style="color:#f87171;border-color:#f87171">Eliminar</button>';
      div.querySelector('button').addEventListener('click', function (e) {
        e.stopPropagation();
        onEliminarCentroCosto(c.id, c.nombre);
      });
      container.appendChild(div);
    });
  }

  function onCrearCentroCosto(e) {
    e.preventDefault();
    var codigo = document.getElementById('centro-costo-codigo').value.trim();
    var nombre = document.getElementById('centro-costo-nombre').value.trim();
    if (!codigo || !nombre) { toast('Ingresa codigo y nombre', 'error'); return; }
    API.crearCentroCosto(codigo, nombre).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      document.getElementById('centro-costo-codigo').value = '';
      document.getElementById('centro-costo-nombre').value = '';
      cargarCentrosCosto();
      toast('Centro de costo creado', 'success');
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  function onEliminarCentroCosto(id, nombre) {
    if (!confirm('Eliminar centro de costo "' + nombre + '"? Los detalles asignados quedaran sin centro de costo.')) return;
    API.eliminarCentroCosto(id).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      cargarCentrosCosto();
      toast('Centro de costo eliminado', 'success');
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  function renderTrabajadores(lista) {
    var container = document.getElementById('lista-trabajadores');
    if (!lista || lista.length === 0) {
      container.innerHTML = '<p class="vacio">No hay trabajadores vinculados aun. Pide el codigo a tu trabajador.</p>';
      return;
    }
    container.innerHTML = '';
    lista.forEach(function (t) {
      var div = document.createElement('div');
      div.className = 'rendicion-item';
      div.style.cursor = 'pointer';
      div.innerHTML =
        '<div class="r-empresa">' + escaparHTML(t.email) +
        ' <span class="badge-tipo">cod: ' + escaparHTML(t.codigo_trabajador || 'N/A') + '</span></div>' +
        '<div class="r-detalle">Vinculado: ' + (t.vinculado_en ? t.vinculado_en.split('T')[0] : '') + '</div>' +
        '<div class="r-montos"><span class="total" style="color:#38bdf8">Ver rendiciones &rarr;</span></div>';
      div.addEventListener('click', function () {
        mostrarListaRendicionesContador(t.id, t.email);
      });
      container.appendChild(div);
    });
  }

  function onVincular(e) {
    e.preventDefault();
    var codigo = document.getElementById('codigo-vincular').value.trim();
    if (!codigo) { toast('Ingresa un codigo', 'error'); return; }
    API.vincularTrabajador(codigo).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      toast('Trabajador vinculado exitosamente', 'success');
      document.getElementById('codigo-vincular').value = '';
      cargarDashboardContador();
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  // ═══════════════════════════════════════════════
  //  NUEVA RENDICION
  // ═══════════════════════════════════════════════

  function seleccionarTipoRendicion(tipo, titulo) {
    tipoRendicionSeleccionado = tipo;
    document.getElementById('card-tipo-rendicion').classList.add('hidden');
    document.getElementById('card-form-rendicion').classList.remove('hidden');
    document.getElementById('titulo-form-rendicion').textContent = titulo;

    var btnCompania = document.getElementById('btn-tipo-compania');
    var btnRest = document.getElementById('btn-tipo-restitucion');
    btnCompania.classList.remove('btn-tipo-selected');
    btnRest.classList.remove('btn-tipo-selected');
    if (tipo === 'compania') btnCompania.classList.add('btn-tipo-selected');
    else btnRest.classList.add('btn-tipo-selected');

    var hoy = new Date();
    document.getElementById('rendicion-fecha').value = hoy.getFullYear() + '-' +
      ('0' + (hoy.getMonth() + 1)).slice(-2) + '-' + ('0' + hoy.getDate()).slice(-2);
    document.getElementById('rendicion-nombre').value = '';
    document.getElementById('rendicion-monto').value = '';
  }

  function onCrearRendicion(e) {
    e.preventDefault();
    if (!tipoRendicionSeleccionado) { toast('Selecciona un tipo de rendicion', 'error'); return; }
    var nombre = document.getElementById('rendicion-nombre').value.trim();
    var fecha = document.getElementById('rendicion-fecha').value;
    var monto = parseFloat(document.getElementById('rendicion-monto').value) || 0;

    if (!nombre) { toast('Ingresa el nombre de la rendicion', 'error'); return; }
    if (!fecha) { toast('Selecciona la fecha', 'error'); return; }
    if (monto <= 0) { toast('Ingresa un monto valido', 'error'); return; }

    API.crearRendicionEjecutiva(tipoRendicionSeleccionado, nombre, fecha, monto).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      toast('Rendicion creada exitosamente', 'success');
      tipoRendicionSeleccionado = null;
      mostrarVista('dashboardEjecutivo');
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  // ═══════════════════════════════════════════════
  //  LISTA DE RENDICIONES
  // ═══════════════════════════════════════════════

  function mostrarListaRendiciones(titulo, estado) {
    document.getElementById('titulo-lista-rendiciones').textContent = titulo;
    mostrarVista('listaRendiciones');
    var container = document.getElementById('lista-rendiciones-ejecutivas');
    container.innerHTML = '<p class="vacio">Cargando...</p>';

    API.listarRendiciones(estado).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      renderListaRendiciones(data, container, false);
    }).catch(function () { toast('Error al cargar rendiciones', 'error'); });
  }

  function mostrarListaRendicionesContador(trabajadorId, email) {
    document.getElementById('titulo-lista-rendiciones').textContent = 'Rendiciones de ' + email;
    mostrarVista('listaRendiciones');
    var container = document.getElementById('lista-rendiciones-ejecutivas');
    container.innerHTML = '<p class="vacio">Cargando...</p>';

    API.listarRendiciones('').then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      var filtradas = data.filter(function (r) { return r.usuario_id === trabajadorId; });
      renderListaRendiciones(filtradas, container, true);
    }).catch(function () { toast('Error al cargar rendiciones', 'error'); });
  }

  function renderListaRendiciones(lista, container, esContador) {
    if (!lista || lista.length === 0) {
      container.innerHTML = '<p class="vacio">No hay rendiciones.</p>';
      return;
    }
    container.innerHTML = '';
    lista.forEach(function (r) {
      var div = document.createElement('div');
      div.className = 'rendicion-item';
      div.style.cursor = 'pointer';
      var tipoLabel = r.tipo === 'compania' ? 'Compania' : 'Restitucion';
      var estadoClass = r.estado === 'activa' ? 'activa' : 'cerrada';
      div.innerHTML =
        '<div class="r-empresa">' + escaparHTML(r.nombre) +
        ' <span class="badge-tipo">' + tipoLabel + '</span>' +
        ' <span class="badge-estado ' + estadoClass + '">' + r.estado + '</span></div>' +
        '<div class="r-detalle">Fecha: ' + escaparHTML(r.fecha) + '</div>' +
        '<div class="r-montos">' +
          '<span class="total">Monto: $' + formatearNumero(r.monto_total) + '</span>' +
          '<span class="neto">Rendido: $' + formatearNumero(r.total_rendido || 0) + '</span>' +
        '</div>';

      div.addEventListener('click', function () {
        rendicionActual = r;
        if (esContador || Storage.obtenerUserRol() === 'contador') {
          abrirDetalleContador(r.id);
        } else {
          abrirDetalleRendicion(r.id);
        }
      });
      container.appendChild(div);
    });
  }

  // ═══════════════════════════════════════════════
  //  DETALLE RENDICION (TRABAJADOR)
  // ═══════════════════════════════════════════════

  function abrirDetalleRendicion(rendicionId) {
    mostrarVista('detalleRendicion');
    API.obtenerRendicion(rendicionId).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      rendicionActual = data;
      renderDetalleRendicion(data);
    }).catch(function () { toast('Error al cargar rendicion', 'error'); });
  }

  function renderDetalleRendicion(r) {
    document.getElementById('detalle-nombre-rendicion').textContent = r.nombre;
    var tipoLabel = r.tipo === 'compania' ? 'Dinero de la compania' : 'Restitucion fondos propios';
    var estadoClass = r.estado === 'activa' ? 'activa' : 'cerrada';
    document.getElementById('detalle-info-rendicion').innerHTML =
      '<p>Tipo: <span class="badge-estado ' + r.tipo + '">' + tipoLabel + '</span>' +
      ' <span class="badge-estado ' + estadoClass + '">' + r.estado + '</span></p>' +
      '<p>Fecha: ' + escaparHTML(r.fecha) + '</p>' +
      '<p class="monto-label">Monto a rendir: $' + formatearNumero(r.monto_total) + '</p>' +
      '<p class="monto-label" style="color:#34d399">Total rendido: $' + formatearNumero(r.total_rendido || 0) + '</p>';

    var cerrada = r.estado === 'cerrada';
    document.getElementById('card-agregar-gasto').classList.toggle('hidden', cerrada);
    document.getElementById('card-cerrar-rendicion').classList.toggle('hidden', cerrada);
    document.getElementById('card-exportar-email').classList.toggle('hidden', !cerrada);

    var container = document.getElementById('lista-detalles');
    if (!r.detalles || r.detalles.length === 0) {
      container.innerHTML = '<p class="vacio">No hay gastos registrados.</p>';
    } else {
      container.innerHTML = '';
      r.detalles.forEach(function (d) {
        var div = document.createElement('div');
        div.className = 'detalle-item';
        var tipoBadge = d.tipo_gasto_entrada ? '<span class="badge-tipo">' + d.tipo_gasto_entrada + '</span>' : '';
        div.innerHTML =
          '<div class="d-header">' +
            '<span class="d-empresa">' + escaparHTML(d.empresa_emite || d.tipo_gasto_entrada) + tipoBadge + '</span>' +
            '<span class="d-monto">$' + formatearNumero(d.monto_total || 0) + '</span>' +
          '</div>' +
          '<div class="d-info">' +
            (d.nro_documento ? 'Doc #' + escaparHTML(d.nro_documento) + ' &middot; ' : '') +
            (d.rut_emisor ? 'RUT ' + escaparHTML(d.rut_emisor) + ' &middot; ' : '') +
            (d.fecha || '') +
          '</div>' +
          (d.tipo_gasto ? '<div class="d-info">Tipo: ' + escaparHTML(d.tipo_gasto) + '</div>' : '') +
          (d.descripcion ? '<div class="d-info">' + escaparHTML(d.descripcion) + '</div>' : '') +
          (d.imagen_url ? '<a href="' + d.imagen_url + '" target="_blank" class="link-foto">Ver foto</a>' : '');
        container.appendChild(div);
      });
    }
  }

  function onCerrarRendicion() {
    if (!rendicionActual) return;
    if (!confirm('Seguro que deseas cerrar esta rendicion? No se podran agregar mas gastos.')) return;
    API.cerrarRendicion(rendicionActual.id).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      toast('Rendicion cerrada', 'success');
      abrirDetalleRendicion(rendicionActual.id);
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  // ═══════════════════════════════════════════════
  //  DETALLE RENDICION (CONTADOR - SOLO LECTURA)
  // ═══════════════════════════════════════════════

  function abrirDetalleContador(rendicionId) {
    mostrarVista('detalleContador');
    API.obtenerRendicion(rendicionId).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      rendicionActual = data;
      renderDetalleContador(data);
    }).catch(function () { toast('Error al cargar rendicion', 'error'); });
  }

  function renderDetalleContador(r) {
    document.getElementById('detalle-contador-nombre').textContent = r.nombre;
    var tipoLabel = r.tipo === 'compania' ? 'Dinero de la compania' : 'Restitucion fondos propios';
    var estadoClass = r.estado === 'activa' ? 'activa' : 'cerrada';
    document.getElementById('detalle-contador-info').innerHTML =
      '<p>Tipo: <span class="badge-estado ' + r.tipo + '">' + tipoLabel + '</span>' +
      ' <span class="badge-estado ' + estadoClass + '">' + r.estado + '</span></p>' +
      '<p>Fecha: ' + escaparHTML(r.fecha) + '</p>' +
      '<p class="monto-label">Monto a rendir: $' + formatearNumero(r.monto_total) + '</p>' +
      '<p class="monto-label" style="color:#34d399">Total rendido: $' + formatearNumero(r.total_rendido || 0) + '</p>';

    API.listarCentrosCosto().then(function (centros) {
      var centrosLista = centros.error ? [] : (centros || []);
      var container = document.getElementById('lista-detalles-contador');
      if (!r.detalles || r.detalles.length === 0) {
        container.innerHTML = '<p class="vacio">No hay gastos registrados.</p>';
      } else {
        container.innerHTML = '';
        r.detalles.forEach(function (d) {
          var div = document.createElement('div');
          div.className = 'detalle-item';
          var tipoBadge = d.tipo_gasto_entrada ? '<span class="badge-tipo">' + d.tipo_gasto_entrada + '</span>' : '';

          var options = '<option value="">Sin centro de costo</option>';
          centrosLista.forEach(function (c) {
            var sel = d.centro_costo_id === c.id ? ' selected' : '';
            options += '<option value="' + c.id + '"' + sel + '>' + escaparHTML(c.codigo + ' - ' + c.nombre) + '</option>';
          });

          div.innerHTML =
            '<div class="d-header">' +
              '<span class="d-empresa">' + escaparHTML(d.empresa_emite || d.tipo_gasto_entrada) + tipoBadge + '</span>' +
              '<span class="d-monto">$' + formatearNumero(d.monto_total || 0) + '</span>' +
            '</div>' +
            '<div class="d-info">' +
              (d.nro_documento ? 'Doc #' + escaparHTML(d.nro_documento) + ' &middot; ' : '') +
              (d.rut_emisor ? 'RUT ' + escaparHTML(d.rut_emisor) + ' &middot; ' : '') +
              (d.fecha || '') +
            '</div>' +
            (d.tipo_gasto ? '<div class="d-info">Tipo: ' + escaparHTML(d.tipo_gasto) + '</div>' : '') +
            (d.descripcion ? '<div class="d-info">' + escaparHTML(d.descripcion) + '</div>' : '') +
            '<div class="d-info" style="margin-top:6px">' +
              '<label style="display:inline;margin:0;font-size:0.72rem">Centro de costo: </label>' +
              '<select class="select-cc" data-detalle-id="' + d.id + '" style="width:auto;padding:4px 8px;font-size:0.78rem;margin-left:4px">' + options + '</select>' +
            '</div>' +
            (d.imagen_url ? '<a href="' + d.imagen_url + '" target="_blank" class="link-foto">Ver foto</a>' : '');
          container.appendChild(div);
        });

        container.querySelectorAll('.select-cc').forEach(function (sel) {
          sel.addEventListener('change', function () {
            var detalleId = parseInt(this.dataset.detalleId);
            var centroId = this.value ? parseInt(this.value) : null;
            API.asignarCentroCosto(r.id, detalleId, centroId).then(function (data) {
              if (data.error) { toast(data.error, 'error'); return; }
              toast('Centro de costo asignado', 'success');
            }).catch(function () { toast('Error de conexion', 'error'); });
          });
        });
      }
    }).catch(function () { toast('Error al cargar centros de costo', 'error'); });
  }

  // ═══════════════════════════════════════════════
  //  EXPORTAR EXCEL Y ENVIAR CORREO
  // ═══════════════════════════════════════════════

  function onExportarExcel(esContador) {
    var rendId = rendicionActual ? rendicionActual.id : null;
    if (!rendId) { toast('No hay rendicion seleccionada', 'error'); return; }

    API.descargarExcelContable(rendId).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      var url = window.URL.createObjectURL(data);
      var a = document.createElement('a');
      a.href = url;
      a.download = (rendicionActual.nombre || 'rendicion').replace(/ /g, '_') + '.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast('Excel descargado', 'success');
    }).catch(function () { toast('Error al descargar Excel', 'error'); });
  }

  function onEnviarCorreo(esContador) {
    var rendId = rendicionActual ? rendicionActual.id : null;
    if (!rendId) { toast('No hay rendicion seleccionada', 'error'); return; }
    var emailId = esContador ? 'email-destinatario-contador' : 'email-destinatario';
    var email = document.getElementById(emailId).value.trim();
    if (!email) { toast('Ingresa un email de destino', 'error'); return; }

    API.enviarRendicionCorreo(rendId, email).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      toast('Correo enviado a ' + email, 'success');
      document.getElementById(emailId).value = '';
    }).catch(function (err) { toast('Error de red: ' + (err.message || 'sin conexion'), 'error'); });
  }

  // ═══════════════════════════════════════════════
  //  MODO LIBRE (unchanged logic, adapted)
  // ═══════════════════════════════════════════════

  function onRegistro(e) {
    e.preventDefault();
    var nombre = document.getElementById('nombre').value.trim();
    var proyecto = document.getElementById('proyecto').value.trim();
    if (!nombre || !proyecto) { toast('Completa todos los campos', 'error'); return; }

    API.crearProyecto(nombre, proyecto).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      Storage.guardarSesion(data.id, nombre, proyecto);
      document.getElementById('card-nuevo-plan').classList.add('hidden');
      document.getElementById('id-generado-text').textContent = data.id;
      document.getElementById('card-id-generado').classList.remove('hidden');
      toast('Plan creado con ID: ' + data.id, 'success');
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  function onIrDashboardNuevo() {
    mostrarVista('dashboard');
    cargarDashboard();
  }

  function onUnirse(e) {
    e.preventDefault();
    var id = document.getElementById('id-unirse').value.trim();
    var proyecto = document.getElementById('proyecto-unirse').value.trim();
    var nombre = document.getElementById('nombre-unirse').value.trim();
    if (!id || !proyecto || !nombre) { toast('Completa todos los campos', 'error'); return; }

    API.unirseProyecto(id, nombre, proyecto).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      Storage.guardarSesion(data.id, nombre, data.nombre);
      mostrarVista('dashboard');
      cargarDashboard();
      toast('Te uniste al plan ' + data.nombre, 'success');
    }).catch(function () { toast('Error de conexion', 'error'); });
  }

  function onChangeProject() {
    Storage.limpiarSesion();
    mostrarVista('registro');
  }

  function cargarDashboard() {
    var usuario = Storage.obtenerUsuario();
    var proyecto = Storage.obtenerProyecto();
    var idPlan = Storage.obtenerIdProyecto();

    document.getElementById('proyecto-activo').textContent = usuario + ' - ' + proyecto;
    document.getElementById('id-proyecto-dashboard').textContent = idPlan;

    API.obtenerProyecto(idPlan).then(function (data) {
      if (data.error) { toast(data.error, 'error'); return; }
      renderHistorial(data.rendiciones || []);
      var rendiciones = data.rendiciones || [];
      document.getElementById('btn-exportar').style.display = rendiciones.length > 0 ? '' : 'none';

      var total = 0;
      rendiciones.forEach(function (r) { total += (r.monto_total || 0); });
      var cardSplit = document.getElementById('card-split');
      if (total > 0) {
        cardSplit.style.display = '';
        document.getElementById('split-total-label').textContent = 'Total acumulado: $' + total.toLocaleString('es-CL');
        document.getElementById('split-total-label').dataset.total = total;
      } else {
        cardSplit.style.display = 'none';
      }
    }).catch(function () { toast('Error al cargar datos del servidor', 'error'); });
  }

  function renderHistorial(lista) {
    var container = document.getElementById('lista-rendiciones');
    if (lista.length === 0) {
      container.innerHTML = '<p class="vacio">No hay rendiciones aun. Sube tu primera boleta.</p>';
      return;
    }
    container.innerHTML = '';
    lista.forEach(function (r) {
      var div = document.createElement('div');
      div.className = 'rendicion-item';
      var tipoBadge = r.boleta_o_factura ? '<span class="badge-tipo">' + escaparHTML(r.boleta_o_factura) + '</span>' : '';
      var nroStr = r.nro_boleta_factura ? ' #' + escaparHTML(r.nro_boleta_factura) : '';
      div.innerHTML =
        '<div class="r-empresa">' + escaparHTML(r.empresa_emite) + tipoBadge + nroStr + '</div>' +
        '<div class="r-detalle">' + (r.fecha || '') + ' ' + (r.hora || '') + ' - ' + escaparHTML(r.nombre_persona_gasto) + '</div>' +
        '<div class="r-montos">' +
          '<span class="total">Total: $' + formatearNumero(r.monto_total) + '</span>' +
          '<span class="neto">Neto: $' + formatearNumero(r.monto_neto) + '</span>' +
        '</div>' +
        (r.imagen_url ? '<a href="' + r.imagen_url + '" target="_blank" class="link-foto">Ver foto</a>' : '');
      container.appendChild(div);
    });
  }

  function onExportar() {
    var idPlan = Storage.obtenerIdProyecto();
    window.open(API.urlExcel(idPlan), '_blank');
    toast('Descargando Excel...', 'success');
  }

  function onCalcularSplit() {
    var personas = parseInt(document.getElementById('split-personas').value) || 0;
    if (personas <= 0) { toast('Ingresa un numero valido de personas', 'error'); return; }
    var total = parseFloat(document.getElementById('split-total-label').dataset.total) || 0;
    if (total <= 0) { toast('No hay rendiciones que dividir', 'error'); return; }
    var cuota = Math.ceil(total / personas);
    document.getElementById('split-resultado').value = '$' + cuota.toLocaleString('es-CL');
    toast('Cuota: $' + cuota.toLocaleString('es-CL') + ' por persona', 'success');
  }

  // ═══════════════════════════════════════════════
  //  SUBIR BOLETA (shared between modes)
  // ═══════════════════════════════════════════════

  function onNuevaBoleta() {
    imagenSeleccionada = null;
    resultadoOCR = null;
    resetSubir();
    mostrarVista('subir');
  }

  function volverDesdeSubir() {
    if (origenOCR && origenOCR !== 'libre' && rendicionActual) {
      abrirDetalleRendicion(rendicionActual.id);
    } else {
      mostrarVista('dashboard');
      cargarDashboard();
    }
  }

  function resetSubir() {
    document.getElementById('file-input').value = '';
    document.getElementById('doc-input').value = '';
    document.getElementById('preview-img').classList.add('hidden');
    var placeholder = document.getElementById('upload-placeholder');
    placeholder.classList.remove('hidden');
    placeholder.innerHTML = '<span class="upload-icon">&#x1F4F7;</span><p>Toca para tomar una foto o seleccionar una imagen</p><p class="upload-hint">Apunta bien a la boleta para mejor lectura</p>';
    document.getElementById('btn-procesar').classList.add('hidden');
    document.getElementById('btn-otra-foto').classList.add('hidden');
    document.getElementById('btn-capturar').classList.remove('hidden');
    document.getElementById('btn-adjuntar').classList.remove('hidden');
    document.getElementById('ocr-progress').classList.add('hidden');
  }

  function onFileSelected(e) {
    var file = e.target.files[0];
    if (!file) return;
    imagenSeleccionada = file;
    if (file.type === 'application/pdf') {
      document.getElementById('preview-img').classList.add('hidden');
      var placeholder = document.getElementById('upload-placeholder');
      placeholder.classList.remove('hidden');
      placeholder.innerHTML = '<span class="upload-icon">&#128196;</span><p>PDF: ' + file.name + '</p><p class="upload-hint">' + Math.round(file.size / 1024) + ' KB</p>';
      document.getElementById('btn-procesar').classList.remove('hidden');
      document.getElementById('btn-otra-foto').classList.remove('hidden');
      document.getElementById('btn-capturar').classList.add('hidden');
      document.getElementById('btn-adjuntar').classList.add('hidden');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = document.getElementById('preview-img');
      img.src = ev.target.result;
      img.classList.remove('hidden');
      document.getElementById('upload-placeholder').classList.add('hidden');
      document.getElementById('btn-procesar').classList.remove('hidden');
      document.getElementById('btn-otra-foto').classList.remove('hidden');
      document.getElementById('btn-capturar').classList.add('hidden');
      document.getElementById('btn-adjuntar').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }

  function onOtraFoto() { imagenSeleccionada = null; resetSubir(); }

  function abrirFormularioManual() {
    origenOCR = 'libre';
    imagenSeleccionada = null;
    resultadoOCR = null;
    var ahora = new Date();
    document.getElementById('campos-ejecutivo').classList.add('hidden');
    document.getElementById('campo-emisor').value = '';
    document.getElementById('campo-tipo').value = '';
    document.getElementById('campo-nro').value = '';
    document.getElementById('campo-total').value = '';
    document.getElementById('campo-neto').value = '';
    document.getElementById('campo-rut').value = '';
    document.getElementById('campo-tipo-gasto').value = '';
    document.getElementById('campo-descripcion').value = '';
    document.getElementById('campo-fecha').value = ahora.getFullYear() + '-' +
      ('0' + (ahora.getMonth() + 1)).slice(-2) + '-' +
      ('0' + ahora.getDate()).slice(-2);
    document.getElementById('campo-hora').value =
      ('0' + ahora.getHours()).slice(-2) + ':' + ('0' + ahora.getMinutes()).slice(-2);
    mostrarVista('resultado');
  }

  function abrirFormularioManualEjecutivo() {
    imagenSeleccionada = null;
    resultadoOCR = null;
    var ahora = new Date();
    document.getElementById('campos-ejecutivo').classList.remove('hidden');

    var tipoDoc = 'Boleta';
    if (origenOCR === 'ejecutivo-factura') tipoDoc = 'Factura';
    else if (origenOCR === 'ejecutivo-devolucion') { tipoDoc = 'Boleta'; }
    else if (origenOCR === 'ejecutivo-boleta') tipoDoc = 'Boleta';

    document.getElementById('campo-emisor').value = '';
    document.getElementById('campo-tipo').value = tipoDoc;
    document.getElementById('campo-nro').value = '';
    document.getElementById('campo-total').value = '';
    document.getElementById('campo-neto').value = '';
    document.getElementById('campo-rut').value = '';
    document.getElementById('campo-tipo-gasto').value = '';
    document.getElementById('campo-descripcion').value = '';
    document.getElementById('campo-fecha').value = ahora.getFullYear() + '-' +
      ('0' + (ahora.getMonth() + 1)).slice(-2) + '-' +
      ('0' + ahora.getDate()).slice(-2);
    document.getElementById('campo-hora').value =
      ('0' + ahora.getHours()).slice(-2) + ':' + ('0' + ahora.getMinutes()).slice(-2);
    mostrarVista('resultado');
  }

  function onProcesar() {
    if (!imagenSeleccionada) { toast('Primero selecciona una imagen', 'error'); return; }
    var progressEl = document.getElementById('ocr-progress');
    var statusEl = document.getElementById('ocr-status');
    var procesarBtn = document.getElementById('btn-procesar');
    var otraBtn = document.getElementById('btn-otra-foto');
    progressEl.classList.remove('hidden');
    procesarBtn.disabled = true;
    if (otraBtn) otraBtn.disabled = true;

    OCR.procesarImagen(imagenSeleccionada, function (msg) { statusEl.textContent = msg; })
    .then(function (datos) {
      resultadoOCR = datos;
      progressEl.classList.add('hidden');
      procesarBtn.disabled = false;
      if (otraBtn) otraBtn.disabled = false;

      // Show/hide ejecutivo fields
      if (origenOCR && origenOCR !== 'libre') {
        document.getElementById('campos-ejecutivo').classList.remove('hidden');
        document.getElementById('campo-rut').value = datos.rutEmisor || '';
        document.getElementById('campo-tipo-gasto').value = '';
        document.getElementById('campo-descripcion').value = '';
        if (origenOCR === 'ejecutivo-factura') datos.tipoDocumento = 'Factura';
        else if (origenOCR === 'ejecutivo-boleta') datos.tipoDocumento = 'Boleta';
        else if (origenOCR === 'ejecutivo-devolucion') datos.tipoDocumento = 'Boleta';
      } else {
        document.getElementById('campos-ejecutivo').classList.add('hidden');
      }

      document.getElementById('campo-emisor').value = datos.emisor || '';
      document.getElementById('campo-tipo').value = datos.tipoDocumento || '';
      document.getElementById('campo-nro').value = datos.nroDocumento || '';
      document.getElementById('campo-total').value = datos.montoTotal || 0;
      document.getElementById('campo-neto').value = datos.montoNeto || 0;
      document.getElementById('campo-fecha').value = datos.fecha || '';
      document.getElementById('campo-hora').value = datos.hora || '';
      mostrarVista('resultado');
      toast('Documento leido. Verifica y corrige los datos.', 'success');
    }).catch(function (err) {
      progressEl.classList.add('hidden');
      procesarBtn.disabled = false;
      if (otraBtn) otraBtn.disabled = false;
      toast(err.message, 'error');
    });
  }

  // ═══════════════════════════════════════════════
  //  CONFIRMAR (libre or ejecutivo)
  // ═══════════════════════════════════════════════

  function onConfirmar(e) {
    e.preventDefault();
    var empresaEmite = document.getElementById('campo-emisor').value.trim();
    var tipoDocumento = document.getElementById('campo-tipo').value;
    var nroDocumento = document.getElementById('campo-nro').value.trim();
    var montoTotal = parseFloat(document.getElementById('campo-total').value) || 0;
    var montoNeto = parseFloat(document.getElementById('campo-neto').value) || 0;
    var fecha = document.getElementById('campo-fecha').value;
    var hora = document.getElementById('campo-hora').value;

    if (!empresaEmite) { toast('Ingresa la empresa que emite', 'error'); return; }
    if (!tipoDocumento) { toast('Selecciona Boleta o Factura', 'error'); return; }
    if (montoTotal <= 0) { toast('Ingresa un monto total valido', 'error'); return; }

    if (origenOCR && origenOCR !== 'libre') {
      // ── Guardar como detalle de rendicion ejecutiva ──
      var tipoEntrada = 'manual';
      if (origenOCR === 'ejecutivo-boleta') tipoEntrada = 'boleta';
      else if (origenOCR === 'ejecutivo-factura') tipoEntrada = 'factura';
      else if (origenOCR === 'ejecutivo-devolucion') tipoEntrada = 'devolucion';

      var detallePayload = {
        tipo_gasto_entrada: tipoEntrada,
        fecha: fecha,
        rut_emisor: document.getElementById('campo-rut').value.trim(),
        nro_documento: nroDocumento,
        monto_total: montoTotal,
        monto_neto: montoNeto,
        empresa_emite: empresaEmite,
        tipo_gasto: document.getElementById('campo-tipo-gasto').value.trim(),
        descripcion: document.getElementById('campo-descripcion').value.trim()
      };

      function guardarDetalle() {
        API.agregarDetalle(rendicionActual.id, detallePayload).then(function (data) {
          if (data.error) { toast(data.error, 'error'); return; }
          toast('Gasto guardado', 'success');
          imagenSeleccionada = null; resultadoOCR = null;
          resetSubir();
          abrirDetalleRendicion(rendicionActual.id);
        }).catch(function () { toast('Error al guardar', 'error'); });
      }

      if (imagenSeleccionada && typeof supabaseClient !== 'undefined') {
        var fileName = 'ejecutivo_' + rendicionActual.id + '_' + Date.now() + '.jpg';
        supabaseClient.storage.from('boletas').upload(fileName, imagenSeleccionada, {
          cacheControl: '3600', upsert: false
        }).then(function (result) {
          if (!result.error) {
            detallePayload.imagen_url = supabaseClient.storage.from('boletas').getPublicUrl(fileName).data.publicUrl;
          }
          guardarDetalle();
        }).catch(function () { guardarDetalle(); });
      } else {
        guardarDetalle();
      }
    } else {
      // ── Guardar en modo libre ──
      var payload = {
        nombrePersonaGasto: Storage.obtenerUsuario(),
        tipoDocumento: tipoDocumento,
        empresaEmite: empresaEmite,
        nroDocumento: nroDocumento,
        montoNeto: montoNeto,
        montoTotal: montoTotal,
        fecha: fecha,
        hora: hora
      };

      function guardarLibre() {
        API.agregarRendicion(Storage.obtenerIdProyecto(), payload).then(function (data) {
          if (data.error) { toast(data.error, 'error'); return; }
          toast('Boleta guardada en el servidor', 'success');
          imagenSeleccionada = null; resultadoOCR = null; origenOCR = 'libre';
          resetSubir();
          mostrarVista('dashboard');
          cargarDashboard();
        }).catch(function () { toast('Error al guardar en el servidor', 'error'); });
      }

      if (imagenSeleccionada && typeof supabaseClient !== 'undefined') {
        var fileNameLibre = Storage.obtenerIdProyecto() + '_' + Date.now() + '.jpg';
        supabaseClient.storage.from('boletas').upload(fileNameLibre, imagenSeleccionada, {
          cacheControl: '3600', upsert: false
        }).then(function (result) {
          if (!result.error) {
            payload.imagenUrl = supabaseClient.storage.from('boletas').getPublicUrl(fileNameLibre).data.publicUrl;
          }
          guardarLibre();
        }).catch(function () { guardarLibre(); });
      } else {
        guardarLibre();
      }
    }
  }

  // ═══════════════════════════════════════════════
  //  UTILIDADES
  // ═══════════════════════════════════════════════

  function escaparHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatearNumero(num) {
    return (num || 0).toLocaleString('es-CL');
  }

  init();
})();
