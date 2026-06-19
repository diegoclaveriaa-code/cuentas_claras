var OCR = (function () {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function procesarImagen(file, onProgress) {
    return new Promise(function (resolve, reject) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        procesarPDF(file, onProgress).then(resolve).catch(reject);
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        if (typeof onProgress === 'function') onProgress('Preparando archivo...');
        preprocesarImagen(e.target.result, 2.0).then(function (processed) {
          if (typeof onProgress === 'function') onProgress('Iniciando OCR...');
          return Tesseract.recognize(processed, 'spa', {
            logger: function (info) {
              if (info.status === 'recognizing text' && typeof onProgress === 'function') {
                if (typeof onProgress === 'function') onProgress('Leyendo... ' + Math.round((info.progress || 0) * 100) + '%');
              }
            }
          });
        }).then(function (result) {
          var texto = result.data.text;
          var datos = extraerDatos(texto);
          datos.textoCrudo = texto;
          resolve(datos);
        }).catch(function (err) {
          reject(new Error('Error al procesar: ' + err.message));
        });
      };
      reader.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
      reader.readAsDataURL(file);
    });
  }

  function procesarPDF(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise.then(function (pdf) {
          var totalPages = pdf.numPages, allText = '', currentPage = 0;
          function next() {
            if (currentPage >= totalPages) { var d = extraerDatos(allText); d.textoCrudo = allText; resolve(d); return; }
            currentPage++;
            if (typeof onProgress === 'function') onProgress('Pag. ' + currentPage + ' de ' + totalPages);
            pdf.getPage(currentPage).then(function (page) {
              var vp = page.getViewport({ scale: 1.5 });
              var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
              page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
                preprocesarImagen(c.toDataURL('image/png'), 1.5).then(function (p) {
                  return Tesseract.recognize(p, 'spa');
                }).then(function (res) { allText += res.data.text + '\n'; next(); })
                  .catch(function (err) { reject(new Error('OCR pag ' + currentPage + ': ' + err.message)); });
              });
            }).catch(function (err) { reject(new Error('Render pag ' + currentPage + ': ' + err.message)); });
          }
          next();
        }).catch(function (err) { reject(new Error('Error al abrir PDF: ' + err.message)); });
      };
      reader.onerror = function () { reject(new Error('No se pudo leer el PDF.')); };
      reader.readAsArrayBuffer(file);
    });
  }

  function preprocesarImagen(dataUrl, scale) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var w = Math.round(img.width * (scale || 2)), h = Math.round(img.height * (scale || 2));
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        var imageData = ctx.getImageData(0, 0, w, h), data = imageData.data;
        var gray = new Uint8Array(w * h);
        for (var i = 0; i < data.length; i += 4) {
          gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        var umbral = Math.max(calcularUmbralOtsu(gray), 110);
        for (var j = 0; j < gray.length; j++) {
          var pix = j * 4, val = gray[j] > umbral ? 255 : 0;
          data[pix] = data[pix + 1] = data[pix + 2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
        var canvas2 = document.createElement('canvas'); canvas2.width = 1280;
        var ratio = 1280 / w; canvas2.height = Math.round(h * ratio);
        var ctx2 = canvas2.getContext('2d'); ctx2.imageSmoothingEnabled = true; ctx2.imageSmoothingQuality = 'high';
        ctx2.drawImage(canvas, 0, 0, canvas2.width, canvas2.height);
        resolve(canvas2.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  function calcularUmbralOtsu(gray) {
    var hist = new Int32Array(256); for (var i = 0; i < gray.length; i++) hist[gray[i]]++;
    var total = gray.length, sumTotal = 0;
    for (var t = 0; t < 256; t++) sumTotal += t * hist[t];
    var wB = 0, sumB = 0, maxVar = 0, thr = 128;
    for (var t = 0; t < 256; t++) {
      wB += hist[t]; if (wB === 0) continue;
      var wF = total - wB; if (wF === 0) break;
      sumB += t * hist[t];
      var v = wB * wF * (sumB / wB - (sumTotal - sumB) / wF) * (sumB / wB - (sumTotal - sumB) / wF);
      if (v > maxVar) { maxVar = v; thr = t; }
    }
    return thr;
  }

  // ═══════════════════════════════════════════════
  //  EXTRACCION INTELIGENTE DE CAMPOS SII CHILE
  // ═══════════════════════════════════════════════

  function extraerDatos(texto) {
    var lineas = texto.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    var textoUpper = texto.toUpperCase();

    // Detectar tipo de documento
    var tipoDoc = '';
    if (/FACTURA\s+ELECTRONICA|FACTURA\s+ELECTR/i.test(textoUpper)) tipoDoc = 'Factura';
    else if (/FACTURA\s+(?:AFECTA|EXENTA)/i.test(textoUpper)) tipoDoc = 'Factura';
    else if (/\bFACTURA\b/i.test(textoUpper)) tipoDoc = 'Factura';
    else if (/BOLETA\s+ELECTRONICA/i.test(textoUpper)) tipoDoc = 'Boleta';
    else if (/\bBOLETA\b/i.test(textoUpper)) tipoDoc = 'Boleta';

    // Extraer campos individuales
    var datos = {
      emisor: extraerEmisor(lineas),
      tipoDocumento: tipoDoc,
      nroDocumento: extraerNro(lineas, texto),
      rutEmisor: extraerRUT(texto),
      montoTotal: 0,
      montoNeto: 0,
      montoIVA: 0,
      netoCalculado: false,
      fecha: '',
      hora: ''
    };

    // Extraer montos con contexto SII
    var montos = extraerMontosSII(lineas, texto);
    datos.montoNeto = montos.neto;
    datos.montoTotal = montos.total;
    datos.montoIVA = montos.iva;
    datos.netoCalculado = montos.netoCalculado;

    // Si no hay monto total pero hay neto e IVA, calcular total
    if (datos.montoTotal <= 0 && datos.montoNeto > 0 && datos.montoIVA > 0) {
      datos.montoTotal = datos.montoNeto + datos.montoIVA;
    }

    // Si no hay monto neto pero hay total e IVA, calcular neto
    if (datos.montoNeto <= 0 && datos.montoTotal > 0 && datos.montoIVA > 0) {
      datos.montoNeto = Math.round(datos.montoTotal - datos.montoIVA);
      datos.netoCalculado = true;
    }

    // Fecha y hora
    var fh = extraerFechaHora(texto);
    datos.fecha = fh.fecha;
    datos.hora = fh.hora;

    return datos;
  }

  function extraerEmisor(lineas) {
    for (var i = 0; i < Math.min(lineas.length, 10); i++) {
      var ln = lineas[i].toUpperCase();
      if (ln.length > 4 && !/^\d/.test(ln) &&
          !/FACTURA|BOLETA|ELECTRONICA|R\.?U\.?T|GIRO|S\.?I\.?I|TOTAL|NETO|IVA|SUBTOTAL|FECHA|HORA|DIRECCION|TELEFONO|SANTIAGO|CHILE|RESOLUCION|SENOR|COMPROBANTE/i.test(ln) &&
          !/^[\d\s.,$:\/\-]+$/.test(ln)) {
        // Preferir lineas que NO sean Items/productos
        if (!/^\d[\d,.\s]+(?:UN|UNIDAD|KG|LT|GR)/i.test(ln)) {
          return lineas[i].trim();
        }
      }
    }
    return '';
  }

  function extraerRUT(texto) {
    var m = texto.match(/\bR\.?\s*U\.?\s*T\.?\s*:?\s*(\d{1,2}(?:\.\d{3}){2}-[\dkK]|\d{7,9}-[\dkK])/i);
    if (m) return m[1].replace(/\./g, '');
    m = texto.match(/\b(\d{1,2}\.\d{3}\.\d{3}-[\dkK])/i);
    if (m) return m[1].replace(/\./g, '');
    return '';
  }

  function extraerNro(lineas, texto) {
    var patrones = [
      /\b(FACTURA|BOLETA)\s*(?:ELECTRONICA|ELECTR(?:ONICA)?\.?|AFECTA|EXENTA)?\s*(?:N[°º]|Nro\.?|No\.?|Numero|NUMERO|FOLIO|#)\s*:?\s*(\d[\d.,]{3,15})\b/i,
      /\bN[°º]\s*(?:FACTURA|BOLETA|DOC\.?)?\s*:?\s*(\d[\d.,]{3,15})\b/i,
      /\bFOLIO\s*:?\s*(?:N[°º]\s*)?(\d[\d.,]{3,15})\b/i,
      /\bFACTURA\s+(\d{5,15})\b/i,
      /\bBOLETA\s+(\d{5,15})\b/i,
      /\bS\.?I\.?I\.?\b[\s\S]{0,60}?N[°º]\s*:?\s*(\d[\d.,]{3,15})/i
    ];
    for (var p = 0; p < patrones.length; p++) {
      var m = texto.match(patrones[p]);
      if (m) {
        var num = (m[2] || m[1]).replace(/[.,\s]/g, '');
        if (num.length >= 4 && num.length <= 15) return num;
      }
    }
    for (var i = 0; i < lineas.length; i++) {
      var m2 = lineas[i].match(/\bN[°º]|Nro\.?|No\.?\s*:?\s*(\d[\d.,\s]{4,15})\b/i);
      if (m2 && m2[1]) {
        var limpio = m2[1].replace(/[.,\s]/g, '');
        if (limpio.length >= 5 && limpio.length <= 15) return limpio;
      }
    }
    return '';
  }

  // ═══════════════════════════════════════
  //  EXTRACCION DE MONTOS CON CONTEXTO SII
  // ═══════════════════════════════════════

  function extraerMontosSII(lineas, texto) {
    var result = { neto: 0, total: 0, iva: 0, netoCalculado: false };

    // Buscar cada campo individualmente
    result.total = buscarTotal(lineas, texto);
    result.neto = buscarNeto(lineas, texto);
    result.iva = buscarIVA(lineas, texto);

    // Validacion cruzada: si total y neto existen, verificar consistencia
    if (result.total > 0 && result.neto > 0) {
      var ivaEsperado = Math.round(result.total - result.neto);
      if (result.iva > 0 && Math.abs(result.iva - ivaEsperado) > 10) {
        // IVA no coincide, confiar en total y neto
        result.iva = ivaEsperado;
      } else if (result.iva <= 0) {
        result.iva = ivaEsperado;
      }
    }

    // Si no hay neto pero si total e IVA, calcular
    if (result.neto <= 0 && result.total > 0 && result.iva > 0) {
      result.neto = Math.round(result.total - result.iva);
      result.netoCalculado = true;
    }

    // Si no hay total pero hay neto e IVA, calcular
    if (result.total <= 0 && result.neto > 0 && result.iva > 0) {
      result.total = result.neto + result.iva;
    }

    return result;
  }

  function buscarTotal(lineas, texto) {
    // 1. Patrones explicitos
    var patrones = [
      /\bTOTAL\s*:?\s*\$?\s*([\d]{1,3}(?:\.[\d]{3})+[\d.,]*|\d{4,}(?:[.,]\d{1,2})?)\b/i,
      /\bIMPORTE\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bMONTO\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bVALOR\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bTOTAL\s+A\s+PAGAR\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bTOTAL\s+PAGADO\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bA\s+PAGAR\s*:?\s*\$?\s*([\d.,]+)/i
    ];
    for (var p = 0; p < patrones.length; p++) {
      var m = texto.match(patrones[p]);
      if (m) { var v = parsearMonto(m[1]); if (v >= 100) return v; }
    }

    // 2. Buscar TOTAL de abajo hacia arriba (excluir SUBTOTAL y NETO)
    for (var i = lineas.length - 1; i >= 0; i--) {
      if (/\bTOTAL\b|\bIMPORTE\b|\bA\s*PAGAR\b/i.test(lineas[i]) &&
          !/SUBTOTAL|SUB[.\s]*TOTAL|NETO|IVA/i.test(lineas[i])) {
        var nums = lineas[i].match(/[\d.,]+/g);
        if (nums) {
          for (var j = nums.length - 1; j >= 0; j--) {
            var v = parsearMonto(nums[j]); if (v >= 100) return v;
          }
        }
      }
    }

    // 3. Numero DESPUES de linea IVA (formato NETO→IVA→TOTAL)
    var posIVA = -1;
    for (var k = lineas.length - 1; k >= 0; k--) {
      if (/\bIVA\b/i.test(lineas[k]) && !/SUBTOTAL|NETO|TOTAL/i.test(lineas[k])) { posIVA = k; break; }
    }
    if (posIVA >= 0) {
      for (var l = posIVA + 1; l < lineas.length; l++) {
        var n2 = lineas[l].match(/[\d.,]+/g);
        if (n2) {
          var v2 = parsearMonto(n2[n2.length - 1]);
          if (v2 >= 100) return v2;
        }
      }
    }

    // 4. "SON:" seguido de monto
    var mSon = texto.match(/\bSON\s*:?\s*[\s\S]{10,80}?\$?\s*([\d.,]{4,})/i);
    if (mSon) { var vs = parsearMonto(mSon[1]); if (vs >= 100) return vs; }

    // 5. Ultimo numero valido del documento
    for (var n = lineas.length - 1; n >= 0; n--) {
      if (/^[\s\-—=_]+$/.test(lineas[n])) continue;
      var nf = lineas[n].match(/[\d.,]+/g);
      if (nf && nf.length >= 1) {
        var vf = parsearMonto(nf[nf.length - 1]);
        if (vf >= 100 && vf < 100000000) return vf;
      }
    }

    return 0;
  }

  function buscarNeto(lineas, texto) {
    var patrones = [
      /\bBASE\s+IMPONIBLE\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bTOTAL\s+SIN\s+IVA\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bNETO\s+(?:LEGAL\s+)?:?\s*\$?\s*([\d.,]+)/i,
      /\bMONTO\s+NETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bVALOR\s+NETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bIMPORTE\s+NETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bNETO\s*:?\s*\$?\s*([\d.,]+)/i
    ];
    for (var p = 0; p < patrones.length; p++) {
      var m = texto.match(patrones[p]);
      if (m) { var v = parsearMonto(m[1]); if (v >= 100) return v; }
    }

    // Buscar SUBTOTAL/SUBTOTAL (sin IVA) pero que NO sea la misma linea que TOTAL/IVA
    for (var i = 0; i < lineas.length; i++) {
      if (/\bNETO\b|\bBASE\s+IMPONIBLE\b|\bSUBTOTAL\b/i.test(lineas[i]) &&
          !/\bTOTAL\s+(?:A\s+PAGAR|PAGADO|VENTA|CON\s+IVA)\b/i.test(lineas[i]) &&
          !/\bIVA\b/i.test(lineas[i])) {
        var nums = lineas[i].match(/[\d.,]+/g);
        if (nums) {
          for (var j = nums.length - 1; j >= 0; j--) {
            var v = parsearMonto(nums[j]); if (v >= 100) return v;
          }
        }
      }
    }

    // Si hay IVA y Total, calcular neto
    var iva = buscarIVA(lineas, texto);
    var total = buscarTotal(lineas, texto);
    if (total > 0 && iva > 0 && total > iva) {
      return Math.round(total - iva);
    }

    return 0;
  }

  function buscarIVA(lineas, texto) {
    // IVA 19%: 1.900
    var m = texto.match(/\bIVA\s*(?:19%|19\s*%)?\s*:?\s*\$?\s*([\d.,]+)/i);
    if (m) { var v = parsearMonto(m[1]); if (v >= 10) return v; }
    // "IVA: 1900"
    for (var i = 0; i < lineas.length; i++) {
      if (/^\s*IVA\b/i.test(lineas[i]) || /\bIVA\s*:/.test(lineas[i])) {
        var nums = lineas[i].match(/[\d.,]+/g);
        if (nums) {
          for (var j = nums.length - 1; j >= 0; j--) {
            var v2 = parsearMonto(nums[j]);
            if (v2 >= 10 && v2 < 100000000) return v2;
          }
        }
      }
    }
    return 0;
  }

  function extraerFechaHora(texto) {
    var hoy = new Date();
    var fecha = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2) + '-' + ('0' + hoy.getDate()).slice(-2);
    var hora = ('0' + hoy.getHours()).slice(-2) + ':' + ('0' + hoy.getMinutes()).slice(-2);

    var mf = texto.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (mf) {
      var d = parseInt(mf[1]), me = parseInt(mf[2]), a = parseInt(mf[3]);
      if (a < 100) a += 2000;
      if (d >= 1 && d <= 31 && me >= 1 && me <= 12) {
        var dt = new Date(a, me - 1, d);
        if (!isNaN(dt.getTime())) fecha = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
      }
    }
    var mh = texto.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
    if (mh) {
      var hh = parseInt(mh[1]), mm = parseInt(mh[2]);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) hora = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
    }
    return { fecha: fecha, hora: hora };
  }

  function parsearMonto(str) {
    if (!str) return 0;
    var s = str.replace(/[$\s]/g, '');
    var tc = s.indexOf(','), tp = s.indexOf('.');
    if (tc !== -1 && tp !== -1) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
      else s = s.replace(/,/g, '');
    } else if (tc !== -1) {
      var p = s.split(',');
      if (p.length === 2 && p[1].length <= 2 && p[0].length > 2) s = s.replace(/,/g, '.');
      else s = s.replace(/,/g, '');
    } else if (tp !== -1) {
      var pp = s.split('.');
      if (!(pp.length === 2 && pp[1].length <= 2 && pp[0].length > 2)) s = s.replace(/\./g, '');
    }
    var v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }

  return { procesarImagen: procesarImagen };
})();

