var OCR = (function () {
  function procesarImagen(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var imageData = e.target.result;
        if (typeof onProgress === 'function') {
          onProgress('Pre-procesando imagen...');
        }
        preprocesarImagen(imageData, 2.0).then(function (processed) {
          if (typeof onProgress === 'function') {
            onProgress('Iniciando motor OCR...');
          }
          return Tesseract.recognize(processed, 'spa', {
            logger: function (info) {
              if (info.status === 'recognizing text' && typeof onProgress === 'function') {
                var pct = Math.round((info.progress || 0) * 100);
                onProgress('Leyendo texto... ' + pct + '%');
              }
            }
          });
        }).then(function (result) {
          var texto = result.data.text;
          var datos = extraerCampos(texto);
          datos.textoCrudo = texto;
          resolve(datos);
        }).catch(function (err) {
          reject(new Error('Error al procesar la imagen: ' + err.message));
        });
      };
      reader.onerror = function () {
        reject(new Error('No se pudo leer la imagen.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function preprocesarImagen(dataUrl, scale) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var w = Math.round(img.width * (scale || 2));
        var h = Math.round(img.height * (scale || 2));
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var imageData = ctx.getImageData(0, 0, w, h);
        var data = imageData.data;

        // 1. Convertir a escala de grises y calcular histograma
        var gray = new Uint8Array(w * h);
        for (var i = 0; i < data.length; i += 4) {
          var r = data[i];
          var g = data[i + 1];
          var b = data[i + 2];
          var v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          gray[i / 4] = v;
        }

        // 2. Calcular umbral adaptativo (metodo Otsu simplificado)
        var umbral = calcularUmbral(gray);

        // 3. Aplicar binarizacion + aumento de contraste
        for (var j = 0; j < gray.length; j++) {
          var pix = j * 4;
          var val = gray[j] > umbral ? 255 : 0;
          // anti-alias leve en bordes
          if (gray[j] > umbral - 15 && gray[j] < umbral + 15) {
            val = gray[j] > umbral ? 255 : 0;
          }
          data[pix] = val;
          data[pix + 1] = val;
          data[pix + 2] = val;
        }

        ctx.putImageData(imageData, 0, 0);

        // 4. Escalar 2x para mejorar lectura de texto pequeno
        var canvas2 = document.createElement('canvas');
        canvas2.width = 1280;
        var ratio = 1280 / w;
        canvas2.height = Math.round(h * ratio);
        var ctx2 = canvas2.getContext('2d');
        ctx2.imageSmoothingEnabled = true;
        ctx2.imageSmoothingQuality = 'high';
        ctx2.drawImage(canvas, 0, 0, canvas2.width, canvas2.height);

        resolve(canvas2.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  function calcularUmbral(gray) {
    var histograma = new Int32Array(256);
    for (var i = 0; i < gray.length; i++) {
      histograma[gray[i]]++;
    }
    var total = gray.length;
    var sumaTotal = 0;
    for (var t = 0; t < 256; t++) {
      sumaTotal += t * histograma[t];
    }
    var pesoFondo = 0;
    var sumaFondo = 0;
    var maxVarianza = 0;
    var umbral = 128;
    for (var t = 0; t < 256; t++) {
      pesoFondo += histograma[t];
      if (pesoFondo === 0) continue;
      var pesoFrente = total - pesoFondo;
      if (pesoFrente === 0) break;
      sumaFondo += t * histograma[t];
      var mediaFondo = sumaFondo / pesoFondo;
      var mediaFrente = (sumaTotal - sumaFondo) / pesoFrente;
      var varianza = pesoFondo * pesoFrente * (mediaFondo - mediaFrente) * (mediaFondo - mediaFrente);
      if (varianza > maxVarianza) {
        maxVarianza = varianza;
        umbral = t;
      }
    }
    return Math.max(umbral, 110);
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
      /\bIMPORTE\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bMONTO\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\$?\s*([\d.,]+)\s*$/im
    ];
    for (var p = 0; p < patrones.length; p++) {
      var match = texto.match(patrones[p]);
      if (match) return parsearMonto(match[1]);
    }
    var montos = [];
    var regexMonto = /\$?\s*([\d]{1,3}(?:\.[\d]{3})+|[\d]{4,}(?:[.,]\d{3})*|\d{4,})(?:\s*(?:$|\n| ))/g;
    var m;
    while ((m = regexMonto.exec(texto)) !== null) {
      var valor = parsearMonto(m[1]);
      if (valor > 0) montos.push(valor);
    }
    return montos.length > 0 ? Math.max.apply(null, montos) : 0;
  }

  function extraerMontoNeto(texto) {
    var patrones = [
      /NETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /SUBTOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /SUB[.\s]*TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /BASE\s+IMPONIBLE\s*:?\s*\$?\s*([\d.,]+)/i
    ];
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
    var s = str.replace(/[$\s]/g, '');
    var tieneComa = s.indexOf(',') !== -1;
    var tienePunto = s.indexOf('.') !== -1;
    if (tieneComa && tienePunto) {
      var posComa = s.lastIndexOf(',');
      var posPunto = s.lastIndexOf('.');
      if (posComa > posPunto) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (tieneComa) {
      var partes = s.split(',');
      if (partes.length === 2 && partes[1].length <= 2 && partes[0].length > 2) {
        s = s.replace(/,/g, '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (tienePunto) {
      var partesP = s.split('.');
      if (partesP.length === 2 && partesP[1].length <= 2 && partesP[0].length > 2) {
        // ya esta en formato decimal con punto, dejar como esta
      } else {
        s = s.replace(/\./g, '');
      }
    }
    var val = parseFloat(s);
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

