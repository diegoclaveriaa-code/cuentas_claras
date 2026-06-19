(function () {
  'use strict';

  var vistas = {
    registro: document.getElementById('view-registro'),
    dashboard: document.getElementById('view-dashboard'),
    subir: document.getElementById('view-subir'),
    resultado: document.getElementById('view-resultado')
  };

  var imagenSeleccionada = null;
  var resultadoOCR = null;

  function init() {
    if (Storage.estaLogueado()) {
      mostrarVista('dashboard');
      cargarDashboard();
    } else {
      mostrarVista('registro');
    }

    document.getElementById('form-registro').addEventListener('submit', onRegistro);
    document.getElementById('form-unirse').addEventListener('submit', onUnirse);
    document.getElementById('btn-ir-dashboard-nuevo').addEventListener('click', onIrDashboardNuevo);
    document.getElementById('btn-cambiar-proyecto').addEventListener('click', onChangeProject);
    document.getElementById('btn-nueva-boleta').addEventListener('click', onNuevaBoleta);
    document.getElementById('btn-manual').addEventListener('click', abrirFormularioManual);
    document.getElementById('btn-exportar').addEventListener('click', onExportar);

    document.getElementById('btn-capturar').addEventListener('click', function () {
      document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', onFileSelected);
    document.getElementById('upload-area').addEventListener('click', function () {
      document.getElementById('file-input').click();
    });
    document.getElementById('btn-procesar').addEventListener('click', onProcesar);
    document.getElementById('btn-otra-foto').addEventListener('click', onOtraFoto);

    document.getElementById('btn-volver-subir').addEventListener('click', function () {
      mostrarVista('dashboard');
      cargarDashboard();
    });

    document.getElementById('btn-ir-manual').addEventListener('click', function () {
      abrirFormularioManual();
    });

    document.getElementById('btn-volver-resultado').addEventListener('click', function () {
      mostrarVista('subir');
      resetSubir();
    });

    document.getElementById('form-resultado').addEventListener('submit', onConfirmar);
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

  // ---- Registro / Acceso ----
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
    location.reload();
  }

  // ---- Dashboard ----
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
        (r.imagen_url ? '<a href="' + r.imagen_url + '" target="_blank" class="link-foto">📷 Ver foto</a>' : '');
      container.appendChild(div);
    });
  }

  function onExportar() {
    var idPlan = Storage.obtenerIdProyecto();
    window.open(API.urlExcel(idPlan), '_blank');
    toast('Descargando Excel...', 'success');
  }

  // ---- Subir Boleta ----
  function onNuevaBoleta() { imagenSeleccionada = null; resultadoOCR = null; resetSubir(); mostrarVista('subir'); }

  function resetSubir() {
    document.getElementById('file-input').value = '';
    document.getElementById('preview-img').classList.add('hidden');
    document.getElementById('upload-placeholder').classList.remove('hidden');
    document.getElementById('btn-procesar').classList.add('hidden');
    document.getElementById('btn-otra-foto').classList.add('hidden');
    document.getElementById('btn-capturar').classList.remove('hidden');
    document.getElementById('ocr-progress').classList.add('hidden');
  }

  function onFileSelected(e) {
    var file = e.target.files[0];
    if (!file) return;
    imagenSeleccionada = file;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = document.getElementById('preview-img');
      img.src = ev.target.result;
      img.classList.remove('hidden');
      document.getElementById('upload-placeholder').classList.add('hidden');
      document.getElementById('btn-procesar').classList.remove('hidden');
      document.getElementById('btn-otra-foto').classList.remove('hidden');
      document.getElementById('btn-capturar').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }

  function onOtraFoto() { imagenSeleccionada = null; resetSubir(); }

  function abrirFormularioManual() {
    imagenSeleccionada = null;
    resultadoOCR = null;
    var ahora = new Date();
    document.getElementById('campo-emisor').value = '';
    document.getElementById('campo-tipo').value = '';
    document.getElementById('campo-nro').value = '';
    document.getElementById('campo-total').value = '';
    document.getElementById('campo-neto').value = '';
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

      document.getElementById('campo-emisor').value = datos.emisor || '';
      document.getElementById('campo-tipo').value = datos.tipoDocumento || '';
      document.getElementById('campo-nro').value = datos.nroDocumento || '';
      document.getElementById('campo-total').value = datos.montoTotal || 0;
      document.getElementById('campo-neto').value = datos.montoNeto || 0;
      document.getElementById('campo-fecha').value = datos.fecha || '';
      document.getElementById('campo-hora').value = datos.hora || '';
      mostrarVista('resultado');
      toast('Boleta leida. Verifica y corrige los datos.', 'success');
    }).catch(function (err) {
      progressEl.classList.add('hidden');
      procesarBtn.disabled = false;
      if (otraBtn) otraBtn.disabled = false;
      toast(err.message, 'error');
    });
  }

  // ---- Resultado ----
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

    function guardar() {
      API.agregarRendicion(Storage.obtenerIdProyecto(), payload).then(function (data) {
        if (data.error) { toast(data.error, 'error'); return; }
        toast('Boleta guardada en el servidor', 'success');
        imagenSeleccionada = null; resultadoOCR = null;
        resetSubir();
        mostrarVista('dashboard');
        cargarDashboard();
      }).catch(function () { toast('Error al guardar en el servidor', 'error'); });
    }

    // Si hay imagen seleccionada, subirla a Supabase Storage como respaldo
    if (imagenSeleccionada && typeof supabaseClient !== 'undefined') {
      var fileName = Storage.obtenerIdProyecto() + '_' + Date.now() + '.jpg';
      supabaseClient.storage.from('boletas').upload(fileName, imagenSeleccionada, {
        cacheControl: '3600',
        upsert: false
      }).then(function (result) {
        if (result.error) {
          console.warn('No se pudo subir la imagen:', result.error.message);
        } else {
          var urlData = supabaseClient.storage.from('boletas').getPublicUrl(fileName);
          payload.imagenUrl = urlData.data.publicUrl;
        }
        guardar();
      }).catch(function () {
        guardar();
      });
    } else {
      guardar();
    }
  }

  // ---- Utilidades ----
  function escaparHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatearNumero(num) {
    return num.toLocaleString('es-CL');
  }

  init();
})();

