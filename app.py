import os
import string
import random
import tempfile
import psycopg2
import psycopg2.extras
from flask import Flask, request, jsonify, send_file

app = Flask(__name__, static_folder='static', static_url_path='')

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite://:memory:')

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn

def init_db():
    try:
        with get_db() as db:
            cur = db.cursor()
            cur.execute('''CREATE TABLE IF NOT EXISTS proyectos (
                id TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )''')
            cur.execute('''CREATE TABLE IF NOT EXISTS rendiciones (
                id SERIAL PRIMARY KEY,
                proyecto_id TEXT NOT NULL,
                nombre_persona_gasto TEXT NOT NULL,
                boleta_o_factura TEXT NOT NULL,
                empresa_emite TEXT NOT NULL,
                nro_boleta_factura TEXT,
                monto_neto REAL DEFAULT 0,
                monto_total REAL DEFAULT 0,
                fecha TEXT,
                hora TEXT,
                imagen_url TEXT,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (proyecto_id) REFERENCES proyectos(id)
            )''')
            # Agregar columna imagen_url si la tabla ya existia sin ella
            cur.execute('''ALTER TABLE rendiciones ADD COLUMN IF NOT EXISTS imagen_url TEXT''')
    except Exception as e:
        print("Error inicializando DB:", e)

def generar_id(length=8):
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

# ── Serve static index ────────────────────────────────────────

@app.route('/')
def index():
    return app.send_static_file('index.html')

# ── API: Proyectos ────────────────────────────────────────────

@app.route('/api/proyectos', methods=['POST'])
def crear_proyecto():
    data = request.get_json(silent=True) or {}
    usuario = data.get('usuario', '').strip()
    nombre = data.get('nombre', '').strip()

    if not usuario or not nombre:
        return jsonify({'error': 'Nombre de proyecto y usuario son obligatorios'}), 400

    proj_id = generar_id()
    try:
        with get_db() as db:
            cur = db.cursor()
            cur.execute('INSERT INTO proyectos (id, nombre) VALUES (%s, %s)', (proj_id, nombre))
    except Exception as e:
        return jsonify({'error': 'Error al crear proyecto: ' + str(e)}), 500

    return jsonify({'id': proj_id, 'nombre': nombre, 'usuario': usuario}), 201

@app.route('/api/proyectos/join', methods=['POST'])
def unirse_proyecto():
    data = request.get_json(silent=True) or {}
    proj_id = data.get('id', '').strip()
    usuario = data.get('usuario', '').strip()
    nombre = data.get('nombre', '').strip()

    if not proj_id or not usuario or not nombre:
        return jsonify({'error': 'ID, nombre de proyecto y usuario son obligatorios'}), 400

    with get_db() as db:
        cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute('SELECT * FROM proyectos WHERE id = %s', (proj_id,))
        proyecto = cur.fetchone()
        if not proyecto:
            return jsonify({'error': 'Proyecto no encontrado. Verifica el ID.'}), 404
        if proyecto['nombre'].strip().lower() != nombre.lower():
            return jsonify({'error': 'El nombre del proyecto no coincide con el ID.'}), 400

    return jsonify({'id': proj_id, 'nombre': proyecto['nombre'], 'usuario': usuario})

@app.route('/api/proyectos/<proj_id>', methods=['GET'])
def obtener_proyecto(proj_id):
    with get_db() as db:
        cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute('SELECT * FROM proyectos WHERE id = %s', (proj_id,))
        proyecto = cur.fetchone()
        if not proyecto:
            return jsonify({'error': 'Proyecto no encontrado'}), 404

        cur.execute(
            'SELECT * FROM rendiciones WHERE proyecto_id = %s ORDER BY creado_en DESC',
            (proj_id,)
        )
        rendiciones = cur.fetchall()

        return jsonify({
            'id': proyecto['id'],
            'nombre': proyecto['nombre'],
            'creado_en': proyecto['creado_en'].isoformat() if proyecto.get('creado_en') else None,
            'rendiciones': [dict(r) for r in rendiciones]
        })

# ── API: Rendiciones ──────────────────────────────────────────

@app.route('/api/proyectos/<proj_id>/rendiciones', methods=['POST'])
def agregar_rendicion(proj_id):
    data = request.get_json(silent=True) or {}

    with get_db() as db:
        cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute('SELECT id FROM proyectos WHERE id = %s', (proj_id,))
        if not cur.fetchone():
            return jsonify({'error': 'Proyecto no encontrado'}), 404

        cur.execute('''INSERT INTO rendiciones (
            proyecto_id, nombre_persona_gasto, boleta_o_factura,
            empresa_emite, nro_boleta_factura, monto_neto, monto_total, fecha, hora, imagen_url
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''', (
            proj_id,
            data.get('nombrePersonaGasto', ''),
            data.get('tipoDocumento', ''),
            data.get('empresaEmite', ''),
            data.get('nroDocumento', '') or '',
            data.get('montoNeto', 0) or 0,
            data.get('montoTotal', 0) or 0,
            data.get('fecha', ''),
            data.get('hora', ''),
            data.get('imagenUrl', '') or ''
        ))

    return jsonify({'ok': True}), 201

# ── API: Excel ────────────────────────────────────────────────

@app.route('/api/proyectos/<proj_id>/excel', methods=['GET'])
def descargar_excel(proj_id):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill
    except ImportError:
        return jsonify({'error': 'openpyxl no esta instalado en el servidor'}), 500

    with get_db() as db:
        cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute('SELECT * FROM proyectos WHERE id = %s', (proj_id,))
        proyecto = cur.fetchone()
        if not proyecto:
            return jsonify({'error': 'Proyecto no encontrado'}), 404

        cur.execute(
            'SELECT * FROM rendiciones WHERE proyecto_id = %s ORDER BY creado_en ASC',
            (proj_id,)
        )
        rendiciones = cur.fetchall()

    wb = Workbook()
    ws = wb.active
    ws.title = 'Rendiciones'

    headers = ['nombre_plan', 'id_proyecto', 'nombre_persona_gasto', 'boleta_o_factura',
               'empresa_emite', 'nro_boleta_factura', 'monto_neto', 'monto_total']
    header_fill = PatternFill(start_color='4361EE', end_color='4361EE', fill_type='solid')
    header_font = Font(color='FFFFFF', bold=True)

    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font

    for i, r in enumerate(rendiciones, 2):
        ws.cell(row=i, column=1, value=proyecto['nombre'])
        ws.cell(row=i, column=2, value=proj_id)
        ws.cell(row=i, column=3, value=r['nombre_persona_gasto'])
        ws.cell(row=i, column=4, value=r['boleta_o_factura'])
        ws.cell(row=i, column=5, value=r['empresa_emite'])
        ws.cell(row=i, column=6, value=r['nro_boleta_factura'])
        ws.cell(row=i, column=7, value=r['monto_neto'])
        ws.cell(row=i, column=8, value=r['monto_total'])

    ws.column_dimensions['A'].width = 24
    ws.column_dimensions['B'].width = 16
    ws.column_dimensions['C'].width = 22
    ws.column_dimensions['D'].width = 16
    ws.column_dimensions['E'].width = 28
    ws.column_dimensions['F'].width = 20
    ws.column_dimensions['G'].width = 14
    ws.column_dimensions['H'].width = 14

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
    wb.save(tmp.name)

    nombre_archivo = f"{proyecto['nombre'].replace(' ', '_')}_{proj_id}.xlsx"
    return send_file(tmp.name, as_attachment=True, download_name=nombre_archivo,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# ── Health check ──────────────────────────────────────────────

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

# ── Start ─────────────────────────────────────────────────────

init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)


