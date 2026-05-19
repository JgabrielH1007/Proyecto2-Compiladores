'use strict';

class Conexion {

    static inferirSchema(ast) {
        if (!ast) return '';
        const tablas = {};
        const registrar = (tabla, cols) => {
            if (!tablas[tabla]) tablas[tabla] = new Set(['id']);
            cols.forEach(c => { const t = c.trim(); if (t) tablas[tabla].add(t); });
        };
        const escanear = (rawQuery) => {
            const q = rawQuery.replace(/^`|`$/g, '').trim().replace(/\s+/g, ' ');
            const mUpdate = q.match(/^(\w+)\s*\[(.+)\]\s+IN\s+/is);
            if (mUpdate) { registrar(mUpdate[1], mUpdate[2].split(',').map(p => p.split('=')[0])); return; }
            const mInsert = q.match(/^(\w+)\s*\[(.+)\]$/is);
            if (mInsert) { registrar(mInsert[1], mInsert[2].split(',').map(p => p.split('=')[0])); return; }
            const mTableIns = q.match(/TABLE\s+(\w+)\s*\[(.+)\]/is);
            if (mTableIns) { registrar(mTableIns[1], mTableIns[2].split(',').map(p => p.split('=')[0])); return; }
            const mDel = q.match(/TABLE\s+(\w+)\s+IN/i);
            if (mDel) { registrar(mDel[1], []); return; }
            if (q.includes('.')) {
                const dot = q.indexOf('.');
                const tabla = q.slice(0, dot).trim();
                const col   = q.slice(dot + 1).trim();
                registrar(tabla, col ? [col] : []);
            }
        };
        (ast.globales  || []).forEach(d  => { if (d.tipo  === 'DECLARACION_ARR_DB' && d.query) escanear(d.query); });
        (ast.funciones || []).forEach(fn => { (fn.body || []).forEach(i => { if (i.tipo === 'EXECUTE' && i.query) escanear(i.query); }); });
        if (!Object.keys(tablas).length) return '';
        return Object.entries(tablas).map(([tabla, cols]) => {
            const columnas = [...cols].map(c =>
                c === 'id' ? 'id INTEGER PRIMARY KEY AUTOINCREMENT' : `${c} TEXT`
            ).join(',\n        ');
            return `CREATE TABLE IF NOT EXISTS ${tabla} (\n        ${columnas}\n    );`;
        }).join('\n\n    ');
    }

    static activarTemplates(htmlComponentes) {
        if (!htmlComponentes) return '';
        const regex = /<template\s+id="([^"]+)"\s+data-params="([^"]*)">/gi;
        const registros = [];
        let m;
        while ((m = regex.exec(htmlComponentes)) !== null) {
            const id     = m[1];
            const params = m[2].split(',').map(p => p.trim()).filter(Boolean);
            registros.push(`
    __registrarComponente('${id}', function(args) {
        const tmpl = document.getElementById('${id}');
        if (!tmpl) { console.warn('Template #${id} no encontrado'); return; }

        const __params = ${JSON.stringify(params)};
        const __vals   = {};
        __params.forEach(function(p, i) { __vals[p] = args[i]; });

        function __render(fragment, vars) {
            const keys   = Object.keys(vars);
            const values = Object.values(vars);

            function __eval(expr) {
                expr = String(expr).replace(/\\{\\{([\\s\\S]+?)\\}\\}/g, '$1').trim();
                try {
                    return new Function(...keys, 'return (' + expr + ');')(...values);
                } catch(e) { return expr; }
            }

            //activar condicionales if, else if y else
            const ifNodes = Array.from(fragment.querySelectorAll('template[data-if]')).reverse();
            ifNodes.forEach(function(ifNode) {
                let matched = false;
                const nodesToRemove = [ifNode];
                if (__eval(ifNode.getAttribute('data-if'))) {
                    const clone = document.importNode(ifNode.content, true);
                    __render(clone, vars);
                    ifNode.parentNode.insertBefore(clone, ifNode);
                    matched = true;
                }
                let next = ifNode.nextElementSibling;
                while (next) {
                    if (next.tagName && next.tagName.toLowerCase() !== 'template') break;
                    if (next.hasAttribute('data-elseif')) {
                        nodesToRemove.push(next);
                        if (!matched && __eval(next.getAttribute('data-elseif'))) {
                            const clone = document.importNode(next.content, true);
                            __render(clone, vars);
                            next.parentNode.insertBefore(clone, next);
                            matched = true;
                        }
                        next = next.nextElementSibling;
                    } else if (next.hasAttribute('data-else')) {
                        nodesToRemove.push(next);
                        if (!matched) {
                            const clone = document.importNode(next.content, true);
                            __render(clone, vars);
                            next.parentNode.insertBefore(clone, next);
                        }
                        break;
                    } else break;
                }
                nodesToRemove.forEach(n => { if (n.parentNode) n.remove(); });
            });

            //activar switch
            Array.from(fragment.querySelectorAll('div[data-switch]')).forEach(function(swNode) {
                const exprVal = __eval(swNode.getAttribute('data-switch'));
                let matched = false;
                const result = document.createDocumentFragment();
                Array.from(swNode.children).forEach(function(child) {
                    if (!child.tagName || child.tagName.toLowerCase() !== 'template') return;
                    if (!matched && child.hasAttribute('data-case')) {
                        if (String(exprVal) === String(child.getAttribute('data-case'))) {
                            const clone = document.importNode(child.content, true);
                            __render(clone, vars);
                            result.appendChild(clone);
                            matched = true;
                        }
                    } else if (!matched && child.hasAttribute('data-default')) {
                        const clone = document.importNode(child.content, true);
                        __render(clone, vars);
                        result.appendChild(clone);
                        matched = true;
                    }
                });
                swNode.replaceWith(result);
            });

            // activar bucles for
            Array.from(fragment.querySelectorAll(
                'template[data-fortrack], template[data-foreach]'
            )).forEach(function(forNode) {
                const result    = document.createDocumentFragment();
                let mainArr     = [];
                let iteradores  = [];
                let indexNombre = 'index';

                if (forNode.hasAttribute('data-foreach')) {
                    const raw   = forNode.getAttribute('data-foreach');
                    const parts = raw.split(':');
                    const iter  = (parts[0] || 'item').trim();
                    const col   = (parts[1] || '').trim();
                    mainArr    = Array.isArray(vars[col]) ? vars[col] : [];
                    iteradores = [{ col, iter }];
                } else {
                    const raw   = forNode.getAttribute('data-fortrack');
                    const track = forNode.getAttribute('data-track') || 'index';
                    indexNombre = track.replace(/^\\$/, '').trim();
                    const pares = raw.split(',').map(p => {
                        const parts = p.split(':');
                        return { iter: (parts[0]||'').trim(), col: (parts[1]||'').trim() };
                    });
                    iteradores = pares;
                    const primerCol = pares[0] ? pares[0].col : '';
                    mainArr = Array.isArray(vars[primerCol]) ? vars[primerCol] : [];
                }

                if (mainArr.length > 0) {
                    mainArr.forEach(function(_, idx) {
                        const localVars = Object.assign({}, vars);
                        localVars[indexNombre] = idx;
                        iteradores.forEach(function(par) {
                            const arr = Array.isArray(vars[par.col]) ? vars[par.col] : [];
                            localVars[par.iter] = arr[idx];
                        });
                        const clone = document.importNode(forNode.content, true);
                        __render(clone, localVars);
                        result.appendChild(clone);
                    });
                } else {
                    const emptyTmpl = forNode.nextElementSibling;
                    if (emptyTmpl && emptyTmpl.hasAttribute && emptyTmpl.hasAttribute('data-forempty')) {
                        const clone = document.importNode(emptyTmpl.content, true);
                        __render(clone, vars);
                        result.appendChild(clone);
                        emptyTmpl.remove();
                    }
                }
                forNode.replaceWith(result);
            });

            // interpolar varibles
            fragment.querySelectorAll('*').forEach(function(el) {
                if (el.tagName && el.tagName.toLowerCase() === 'img' && el.hasAttribute('data-src')) {
                    let dataSrc = el.getAttribute('data-src');
                    dataSrc = dataSrc.replace(/\\{\\{([\\s\\S]+?)\\}\\}/g, function(_, expr) { return __eval(expr); });
                    el.setAttribute('src', dataSrc);
                    el.removeAttribute('data-src');
                }
                Array.from(el.attributes).forEach(function(attr) {
                    if (attr.name === 'src' || attr.name === 'data-src') return;
                    if (attr.value && attr.value.includes('{{')) {
                        attr.value = attr.value.replace(/\\{\\{([\\s\\S]+?)\\}\\}/g, function(_, expr) { return __eval(expr); });
                    }
                });
                el.childNodes.forEach(function(node) {
                    if (node.nodeType === 3 && node.textContent.includes('{{')) {
                        node.textContent = node.textContent.replace(/\\{\\{([\\s\\S]+?)\\}\\}/g, function(_, expr) { return __eval(expr); });
                    }
                });
            });
        }

        const clone = document.importNode(tmpl.content, true);
        __render(clone, __vals);
        const root = document.getElementById('yfera-root');
        if (root) root.appendChild(clone);
    });`);
        }
        if (!registros.length) return '';
        return `\n<script>\n(function() {\n${registros.join('\n')}\n})();\n<\/script>`;
    }

    static generarBloqueConexion(opts = {}) {
        const wasmUrl = opts.sqlWasmUrl
            ?? 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm';

        const schemaRaw = (opts.schemaSQL && opts.schemaSQL.trim())
            ? opts.schemaSQL
            : (opts.ast ? this.inferirSchema(opts.ast) : '');

        const schema = schemaRaw
            .replace(/\\/g, '\\\\')
            .replace(/`/g,  '\\`')
            .replace(/\$/g, '\\$');

        return `(function() {

    let __db = null;
    const __componentMap = {};

    window.__registrarComponente = function(id, fn) { __componentMap[id] = fn; };

    window.__renderComponent = function(id, args) {
        const fn = __componentMap[id];
        if (!fn) { console.warn(' Componente no registrado: @' + id); return; }
        try { fn(args); }
        catch (e) { const msg = ' Error en @' + id + ': ' + e.message; console.error(msg); alert(msg); }
    };

    window.__dbExec = function(sql) {
        if (!__db) { const m = ' BD no inicializada'; alert(m); throw new Error(m); }
        try { __db.run(sql); }
        catch (e) { const m = ' Error execute:\\n' + e.message + '\\nSQL: ' + sql; alert(m); throw new Error(m); }
    };

    window.__dbQuery = function(sql) {
        if (!__db) { const m = ' BD no inicializada'; alert(m); throw new Error(m); }
        try {
            const res = __db.exec(sql);
            if (!res || !res.length || !res[0].values.length) return [];
            return res[0].values.map(function(f) { return f[0]; });
        }
        catch (e) { const m = ' Error query: ' + e.message + ' | SQL: ' + sql; alert(m); throw new Error(m); }
    };

    async function __inicializarDB() {
        const SQL = await initSqlJs({ locateFile: function() { return '${wasmUrl}'; } });
        __db = new SQL.Database();

        const schema = \`${schema}\`;
        if (schema.trim()) {
            try { __db.run(schema); }
            catch (e) { throw new Error(' Error schema: ' + e.message); }
        }
    }

    document.addEventListener('DOMContentLoaded', async function() {
        try {
            await __inicializarDB();
            if (typeof __arranque === 'function') await __arranque();
            else console.error('[YFERA] __arranque no definida.');
        } catch (e) { alert('[YFERA] Error de arranque: ' + (e.message || e)); }
    });

})();`.trim();
    }

    static ensamblarHTML(partes, opts = {}) {
        const titulo      = opts.titulo ?? 'App YFERA';
        const activadorJS = this.activarTemplates(partes.htmlComponentes);
        const conexionJS  = this.generarBloqueConexion({
            schemaSQL:  (opts.schemaSQL && opts.schemaSQL.trim()) ? opts.schemaSQL : null,
            ast:        opts.ast ?? null,
            sqlWasmUrl: opts.sqlWasmUrl ?? undefined,
        });

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titulo}</title>

    <!-- sql.js — SQLite en WebAssembly -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js"><\/script>

    <style>

/* Utilidades base */
.yfera-flex-col { display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; }
img { max-width: 100%; max-height: 160px; object-fit: contain; display: block; margin: 0 auto; }

button, .base-button, .success-button {
    cursor: pointer;
    text-align: center;
}

input, select, textarea { box-sizing: border-box; }

/* Carrusel */
.carousel { display: flex; flex-direction: row; overflow-x: auto; gap: 12px; padding: 15px 0; width: 100%; scrollbar-width: thin; }
.carousel img { height: 140px; width: auto; object-fit: cover; border-radius: 8px; flex-shrink: 0; }

/* CSS generado */
${partes.css ?? ''}
    </style>
</head>
<body>
    <div id="yfera-root"></div>

    <!-- HTML generado -->
    <div style="display:none;">
${partes.htmlComponentes ?? ''}
    </div>

    <!-- Conexión SQLite -->
    <script>
${conexionJS}
    <\/script>

    <!-- Activador de templates -->
${activadorJS}

    <!-- JS generado -->
    <script>
${partes.jsTraducido ?? ''}
    <\/script>
</body>
</html>`;
    }
}

module.exports = Conexion;