var OCR = (function () {
  function procesarImagen(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var imageData = e.target.result;
        if (typeof onProgress === 'function') {
          onProgress('Iniciando motor OCR...');
        }
        Tesseract.recognize(imageData, 'spa', {
          logger: function (info) {
            if (info.status === 'recognizing text' && typeof onProgress === 'function') {
              var pct = Math.round((info.progress || 0) * 100);
              onProgress('Leyendo texto... ' + pct + '%');
            }
          }
        })
        .then(function (result) {
          var texto = result.data.text;
          var datos = extraerCampos(texto);
          datos.textoCrudo = texto;
          resolve(datos);
        })
        .catch(function (err) {
          reject(new Error('Error al procesar la imagen: ' + err.message));
        });
      };
      reader.onerror = function () {
        reject(new Error('No se pudo leer la imagen.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function extraerCampos(texto) {
    var lineas = texto.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });

    return {
      emisor: extraerEmisor(lineas),
      tipoDocumento: extraerTipoDocumento(texto),
      nroDocumento: extraerNroDocumento(texto),
      montoTotal: extraerMontoTotal(texto),
      montoNeto: extraerMontoNeto(texto),
      fecha: extraerFechaHora(texto).fecha,
      hora: extraerFechaHora(texto).hora,
      textoCrudo: texto
    };
  }

  function extraerEmisor(lineas) {
    for (var i = 0; i < Math.min(lineas.length, 8); i++) {
      var linea = lineas[i].toUpperCase();
      if (
        linea.length > 4 &&
        !/^\d/.test(linea) &&
        !/FACTURA|BOLETA|ELECTRONICA|R\.?U\.?T|GIRO|S\.?I\.?I|TOTAL|NETO|IVA|SUBTOTAL|FECHA|HORA|DIRECCION|TELEFONO|SANTIAGO|CHILE/i.test(linea) &&
        !/^[\d\s.,$:/-]+$/.test(linea)
      ) {
        return lineas[i].trim();
      }
    }
    return '';
  }

  function extraerTipoDocumento(texto) {
    var upper = texto.toUpperCase();
    if (/FACTURA\s+ELECTRONICA|FACTURA\s+ELECTR/i.test(upper)) return 'Factura';
    if (/\bFACTURA\b/i.test(upper)) return 'Factura';
    if (/\bBOLETA\b/i.test(upper)) return 'Boleta';
    return '';
  }

  function extraerNroDocumento(texto) {
    var patrones = [
      /\b(FACTURA|BOLETA|DOCUMENTO)\s*(?:ELECTRONICA|ELECTR\.?)?\s*(?:N[°º]|No\.?|NUMERO|#)?\s*:?\s*(\d{4,10})\b/i,
      /\bN[°º]\s*(?:FACTURA|BOLETA|DOCUMENTO)?\s*:?\s*(\d{4,10})\b/i,
      /\bFOLIO\s*:?\s*(\d{4,10})\b/i,
      /\bNo\.?\s*:?\s*(\d{4,10})\s*(?:FACTURA|BOLETA)\b/i
    ];
    for (var p = 0; p < patrones.length; p++) {
      var match = texto.match(patrones[p]);
      if (match) {
        var num = match[2] || match[1];
        if (num && num.length >= 4) return num;
      }
    }
    var m = texto.match(/\bN[°º]?\s*:?\s*(\d{5,10})\b/i);
    if (m && m[1].length >= 5) return m[1];
    return '';
  }

  function extraerMontoTotal(texto) {
    var patrones = [
      /\bTOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /TOTAL\s+\$?\s*([\d.,]+)/i,
      /\$?\s*([\d.,]+)\s*$/im
    ];
    for (var p = 0; p < patrones.length; p++) {
      var match = texto.match(patrones[p]);
      if (match) return parsearMonto(match[1]);
    }
    var montos = [];
    var regexMonto = /\$?\s*([\d]{1,3}(?:\.[\d]{3})+|[\d]{4,}(?:\.\d{3})*|\d{4,})(?:\s*$|\n)/g;
    var m;
    while ((m = regexMonto.exec(texto)) !== null) {
      var valor = parsearMonto(m[1]);
      if (valor > 0) montos.push(valor);
    }
    return montos.length > 0 ? Math.max.apply(null, montos) : 0;
  }

  function extraerMontoNeto(texto) {
    var patrones = [/NETO\s*:?\s*\$?\s*([\d.,]+)/i, /SUBTOTAL\s*:?\s*\$?\s*([\d.,]+)/i, /SUB\s*TOTAL\s*:?\s*\$?\s*([\d.,]+)/i];
    for (var p = 0; p < patrones.length; p++) {
      var match = texto.match(patrones[p]);
      if (match) return parsearMonto(match[1]);
    }
    return 0;
  }

  function extraerFechaHora(texto) {
    var hoy = new Date();
    var fecha = formatearFecha(hoy);
    var hora = formatearHora(hoy);
    var matchFecha = texto.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (matchFecha) {
      var dia = parseInt(matchFecha[1]), mes = parseInt(matchFecha[2]), anio = parseInt(matchFecha[3]);
      if (anio < 100) anio += 2000;
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
        var d = new Date(anio, mes - 1, dia);
        if (!isNaN(d.getTime())) fecha = formatearFecha(d);
      }
    }
    var matchHora = texto.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
    if (matchHora) {
      var hh = parseInt(matchHora[1]), mm = parseInt(matchHora[2]);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) hora = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
    }
    return { fecha: fecha, hora: hora };
  }

  function parsearMonto(str) {
    if (!str) return 0;
    var val = parseFloat(str.replace(/\./g, '').replace(/,/g, '.'));
    return isNaN(val) ? 0 : val;
  }

  function formatearFecha(date) {
    return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
  }

  function formatearHora(date) {
    return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
  }

  return { procesarImagen: procesarImagen };
})();
