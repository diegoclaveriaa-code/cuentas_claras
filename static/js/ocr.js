var OCR = (function () {
  // Configurar worker de pdf.js
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function procesarImagen(file, onProgress) {
    return new Promise(function (resolve, reject) {
      // Detectar si es PDF
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        procesarPDF(file, onProgress).then(resolve).catch(reject);
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        var imageData = e.target.result;
        if (typeof onProgress === 'function') {
          onProgress('Preparando archivo...');
        }
        preprocesarImagen(imageData, 2.0).then(function (processed) {
          if (typeof onProgress === 'function') {
            onProgress('Iniciando OCR...');
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

  function procesarPDF(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var pdfData = new Uint8Array(e.target.result);
        pdfjsLib.getDocument({ data: pdfData }).promise.then(function (pdf) {
          var totalPages = pdf.numPages;
          var allText = '';
          var currentPage = 0;

          function processNextPage() {
            if (currentPage >= totalPages) {
              var datos = extraerCampos(allText);
              datos.textoCrudo = allText;
              resolve(datos);
              return;
            }
            currentPage++;
            if (typeof onProgress === 'function') {
              onProgress('Procesando pagina ' + currentPage + ' de ' + totalPages);
            }
            pdf.getPage(currentPage).then(function (page) {
              var scale = 1.5;
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              var ctx = canvas.getContext('2d');
              page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
                var imgData = canvas.toDataURL('image/png');
                preprocesarImagen(imgData, 1.5).then(function (processed) {
                  return Tesseract.recognize(processed, 'spa');
                }).then(function (result) {
                  allText += result.data.text + '\n';
                  processNextPage();
                }).catch(function (err) {
                  reject(new Error('Error en OCR de pagina ' + currentPage + ': ' + err.message));
                });
              });
            }).catch(function (err) {
              reject(new Error('Error al renderizar pagina ' + currentPage + ': ' + err.message));
            });
          }
          processNextPage();
        }).catch(function (err) {
          reject(new Error('Error al abrir PDF: ' + err.message));
        });
      };
      reader.onerror = function () {
        reject(new Error('No se pudo leer el PDF.'));
      };
      reader.readAsArrayBuffer(file);
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
    // Patrones especificos para boletas/facturas chilenas
    var patrones = [
      // "FACTURA ELECTRONICA N° 12345678" o "BOLETA ELECTRONICA Nro 87654321"
      /\b(FACTURA|BOLETA)\s*(?:ELECTRONICA|ELECTR(?:ONICA)?\.?|AFECTA|EXENTA)?\s*(?:N[°º]|Nro\.?|No\.?|Numero|NUMERO|FOLIO|#)\s*:?\s*(\d[\d.,]{3,15})\b/i,
      // "N° FACTURA: 12345678"
      /\bN[°º]\s*(?:FACTURA|BOLETA|DOC\.?)?\s*:?\s*(\d[\d.,]{3,15})\b/i,
      // "FOLIO: 12345678"
      /\bFOLIO\s*:?\s*(?:N[°º]\s*)?(\d[\d.,]{3,15})\b/i,
      // "FACTURA 12345678"
      /\bFACTURA\s+(\d{5,15})\b/i,
      // "BOLETA 12345678"
      /\bBOLETA\s+(\d{5,15})\b/i,
      // SII reference: "S.I.I. - FACTURA ELECTRONICA N° 12345678"
      /\bS\.?I\.?I\.?\b[\s\S]{0,60}?N[°º]\s*:?\s*(\d[\d.,]{3,15})/i
    ];
    for (var p = 0; p < patrones.length; p++) {
      var match = texto.match(patrones[p]);
      if (match) {
        var num = match[2] || match[1];
        if (num) {
          num = num.replace(/[.,\s]/g, '');
          if (num.length >= 4 && num.length <= 15) return num;
        }
      }
    }

    // Buscar en lineas: "N° : 12345678" o "Nro. 12345678"
    var lineas = texto.split(/\r?\n/);
    for (var i = 0; i < lineas.length; i++) {
      var m = lineas[i].match(/\bN[°º]|Nro\.?|No\.?\s*:?\s*(\d[\d.,\s]{4,15})\b/i);
      if (m && m[1]) {
        var limpio = m[1].replace(/[.,\s]/g, '');
        if (limpio.length >= 5 && limpio.length <= 15) return limpio;
      }
    }

    return '';
  }

  function extraerMontoTotal(texto) {
    // ── Fase 1: Patrones explicitos de TOTAL (jerarquia) ──
    var patrones = [
      // Prioridad 1: "TOTAL" solo
      /\bTOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bIMPORTE\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bMONTO\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bVALOR\s+TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      // Prioridad 2: TOTAL con complementos
      /\bTOTAL\s+(?:A\s+PAGAR|PAGADO|VENTA|CON\s+IVA|IVA\s+INCLUIDO|FINAL)\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bA\s+PAGAR\s*:?\s*\$?\s*([\d.,]+)/i,
      // Prioridad 3: patrones generales
      /\bTOTAL\b[\s\S]{0,60}?\$?\s*([\d.,]{4,})/i
    ];
    for (var p = 0; p < patrones.length; p++) {
      var match = texto.match(patrones[p]);
      if (match) {
        var val = parsearMonto(match[1]);
        if (val > 0) return val;
      }
    }

    var lineas = texto.split(/\r?\n/);

    // ── Fase 2: Buscar TOTAL de abajo hacia arriba (NO SUBTOTAL) ──
    for (var i = lineas.length - 1; i >= 0; i--) {
      var ln = lineas[i];
      if (/\bTOTAL\b|\bIMPORTE\b|\bA\s*PAGAR\b|\bMONTO\b|\bVALOR\b/i.test(ln) &&
          !/SUBTOTAL|SUB[.\s]*TOTAL|NETO/i.test(ln)) {
        var nums = ln.match(/[\d.,]+/g);
        if (nums) {
          for (var j = nums.length - 1; j >= 0; j--) {
            var v = parsearMonto(nums[j]);
            if (v >= 100) return v;
          }
        }
      }
    }

    // ── Fase 3: Buscar numero grande DESPUES de "IVA" (formato SII chileno) ──
    // En boletas electronicas chilenas el orden es: NETO → IVA → TOTAL
    var posIVA = -1;
    for (var k = lineas.length - 1; k >= 0; k--) {
      if (/\bIVA\b/i.test(lineas[k])) { posIVA = k; break; }
    }
    if (posIVA >= 0) {
      // Buscar en las lineas DESPUES de IVA
      for (var l = posIVA + 1; l < lineas.length; l++) {
        var numsPostIVA = lineas[l].match(/[\d.,]+/g);
        if (numsPostIVA) {
          for (var m = numsPostIVA.length - 1; m >= 0; m--) {
            var v2 = parsearMonto(numsPostIVA[m]);
            if (v2 >= 100) return v2;
          }
        }
      }
      // Si no hay lineas despues de IVA, buscar en la misma linea de IVA (formato: "IVA 1900 TOTAL 11900")
      var numsMisma = lineas[posIVA].match(/[\d.,]+/g);
      if (numsMisma && numsMisma.length >= 4) {
        return parsearMonto(numsMisma[numsMisma.length - 1]);
      }
    }

    // ── Fase 4: "SON:" o palabras en texto seguidas del total (comun en facturas SII) ──
    var matchSon = texto.match(/\bSON\s*:?\s*[\s\S]{10,80}?\$?\s*([\d.,]{4,})/i);
    if (matchSon) {
      var vSon = parsearMonto(matchSon[1]);
      if (vSon >= 100) return vSon;
    }

    // ── Fase 5: Ultima linea con numero grande (formato: "---" seguido de total) ──
    for (var n = lineas.length - 1; n >= 0; n--) {
      var ln2 = lineas[n];
      if (/^[\s-—=_]+$/.test(ln2)) continue; // saltar lineas separadoras
      var numsFin = ln2.match(/[\d.,]+/g);
      if (numsFin && numsFin.length >= 1) {
        return parsearMonto(numsFin[numsFin.length - 1]);
      }
    }

    // ── Fase 6: Numero mas grande en el ultimo 40% ──
    var tercio = Math.floor(texto.length * 0.6);
    var parteFinal = texto.substring(tercio);
    var todos = parteFinal.match(/\$?\s*[\d.,]{4,}/g) || [];
    var maximo = 0;
    for (var q = 0; q < todos.length; q++) {
      var posible = parsearMonto(todos[q]);
      if (posible > maximo && posible < 100000000) maximo = posible;
    }
    if (maximo > 0) return maximo;

    // ── Fase 7: Numero mas grande en todo el texto ──
    var todosFull = texto.match(/\$?\s*[\d.,]{4,}/g) || [];
    for (var r = 0; r < todosFull.length; r++) {
      var p2 = parsearMonto(todosFull[r]);
      if (p2 > maximo && p2 < 100000000) maximo = p2;
    }
    return maximo;
  }

  function extraerMontoNeto(texto) {
    var patrones = [
      /\bBASE\s+IMPONIBLE\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bBASE\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bTOTAL\s+SIN\s+IVA\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bNETO\s+(?:LEGAL\s+)?:?\s*\$?\s*([\d.,]+)/i,
      /\bMONTO\s+NETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bVALOR\s+NETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bNETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bSUBTOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bSUB[.\s]*TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /\bIMPORTE\s+NETO\s*:?\s*\$?\s*([\d.,]+)/i
    ];
    for (var p = 0; p < patrones.length; p++) {
      var match = texto.match(patrones[p]);
      if (match) {
        var val = parsearMonto(match[1]);
        if (val > 0) return val;
      }
    }

    // Si no encuentra patron explicito, buscar en lineas con NETO/BASE/SUBTOTAL
    var lineas = texto.split(/\r?\n/);
    for (var i = 0; i < lineas.length; i++) {
      if (/\bNETO\b|\bBASE\s+IMPONIBLE\b|\bSUBTOTAL\b/i.test(lineas[i]) &&
          !/\bTOTAL\s+(?:A\s+PAGAR|PAGADO|VENTA|CON\s+IVA)\b/i.test(lineas[i]) &&
          !/\bIVA\b/i.test(lineas[i])) {
        var nums = lineas[i].match(/[\d.,]+/g);
        if (nums) {
          for (var j = nums.length - 1; j >= 0; j--) {
            var v = parsearMonto(nums[j]);
            if (v >= 100) return v;
          }
        }
      }
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
