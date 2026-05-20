'use strict';

class TraductorJS {

    static exprAJS(expr) {
        if (expr === null || expr === undefined) return 'null';
        if (typeof expr === 'boolean') return expr ? 'true' : 'false';
        if (typeof expr === 'number')  return String(expr);
        
        if (typeof expr === 'string') {
            if ((expr.startsWith('"') && expr.endsWith('"')) ||
                (expr.startsWith("'") && expr.endsWith("'"))) {
                
                let inner = expr.slice(1, -1);
                
                inner = inner.replace(/\\/g, '\\\\').replace(/\$\{/g, '\\${');

                inner = inner.replace(/`([^`]+)`/g, function(match, exp) {
                    let jsExp = exp.replace(/\$([a-zA-Z0-9_]+)/g, '$1');
                    return '${' + jsExp + '}';
                });
                
                inner = inner.replace(/`/g, '\\`');
                
                return `\`${inner}\``;
            }
            return `\`${expr}\``;
        }
        
        if (typeof expr !== 'object') return String(expr);
        if (expr.tipo === 'ID')         return expr.val;
        if (expr.tipo === 'ACCESO_ARR') return `${expr.id}[${this.exprAJS(expr.indice)}]`;
        if (expr.op   === '!')          return `(!${this.exprAJS(expr.der)})`;
        if (expr.op   === 'UMINUS')     return `(-${this.exprAJS(expr.der)})`;
        
        const ops = ['+','-','*','/','%','==','!=','<','<=','>','>=','&&','||'];
        if (ops.includes(expr.op)) return `(${this.exprAJS(expr.izq)} ${expr.op} ${this.exprAJS(expr.der)})`;
        
        return '/* expr no traducida */';
    }

    static sqlVal(v) {
        if (v === null || v === undefined) return "''";
        const s = String(v).trim();
        
        if (/^\d+(\.\d+)?$/.test(s)) return s;
        
        if (/^\$\{.+\}$/.test(s)) {
            const varName = s.slice(2, -1);
            return `'\${String(${varName}).replace(/'/g, "''")}'`;
        }
        
        const safeStr = s.replace(/'/g, "''");
        return `'${safeStr}'`;
    }

    static queryAJS(rawQuery) {
        let q = rawQuery.replace(/^`|`$/g, '').trim();
        // Convierte variables
        q = q.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, '${$1}');
        const qUp = q.toUpperCase();

        // Captura: table_name DELETE id
        if (qUp.includes(' DELETE ')) {
            const m = q.match(/^(\w+)\s+DELETE\s+(.+)$/i);
            if (m) return `__dbExec(\`DELETE FROM ${m[1]} WHERE id = ${m[2].trim()}\`)`;
        }

        if (qUp.startsWith('TABLE') && q.includes('[')) {
            const m = q.match(/TABLE\s+(\w+)\s*\[(.+)\]/i);
            if (m) {
                const pares = m[2].split(',').map(p => p.trim());
                const cols  = pares.map(p => p.split('=')[0].trim()).join(', ');
                const vals  = pares.map(p => this.sqlVal(p.split('=')[1].trim())).join(', ');
                return `__dbExec(\`INSERT INTO ${m[1]} (${cols}) VALUES (${vals})\`)`;
            }
        }

        if (q.includes('[') && q.includes(']') && qUp.includes(' IN ')) {
            const m = q.match(/^(\w+)\s*\[(.+)\]\s+IN\s+(.+)$/is);
            if (m) {
                const sets = m[2].split(',').map(p => {
                    const eqIdx = p.indexOf('=');
                    const col   = p.slice(0, eqIdx).trim();
                    const val   = p.slice(eqIdx + 1).trim();
                    return `${col} = ${this.sqlVal(val)}`;
                }).join(', ');
                return `__dbExec(\`UPDATE ${m[1]} SET ${sets} WHERE id = ${m[3].trim()}\`)`;
            }
        }

        if (q.includes('[') && q.includes(']') && !qUp.includes(' IN ')) {
            const m = q.match(/^(\w+)\s*\[(.+)\]$/is);
            if (m) {
                const pares = m[2].split(',').map(p => p.trim()).filter(Boolean);
                const cols  = pares.map(p => p.split('=')[0].trim()).join(', ');
                const vals  = pares.map(p => this.sqlVal(p.split('=').slice(1).join('=').trim())).join(', ');
                return `__dbExec(\`INSERT INTO ${m[1]} (${cols}) VALUES (${vals})\`)`;
            }
        }

        if (q.includes('.')) {
            const dotIdx = q.indexOf('.');
            const tabla  = q.slice(0, dotIdx).trim();
            const col    = q.slice(dotIdx + 1).trim() || '*';
            return `__dbQuery(\`SELECT ${col} FROM ${tabla}\`)`;
        }

        return `__dbExec(\`${q}\`)`;
    }

    static valorPorDefecto(tipo) {
        return { int: '0', float: '0.0', string: "''", boolean: 'false', char: "' '" }[tipo] ?? 'null';
    }

    static forAJS(nodo, esInitFor = false) {
        if (!nodo) return '';
        
        if (nodo.tipo === 'DECLARACION') {
            const val = (nodo.valor !== null && nodo.valor !== undefined)
                ? this.exprAJS(nodo.valor) : this.valorPorDefecto(nodo.tipoDato);
            return `let ${nodo.id} = ${val}`;
        }
        
        if (nodo.tipo === 'ASIGNACION') {
            const asignacion = `${nodo.id} = ${this.exprAJS(nodo.valor)}`;
            return esInitFor ? `let ${asignacion}` : asignacion;
        }
        
        return '';
    }

    static insAJS(instr, nivel = 4) {
        if (!instr) return '';
        const p = ' '.repeat(nivel);

        switch (instr.tipo) {
            case 'DECLARACION': {
                const val = (instr.valor !== null && instr.valor !== undefined)
                    ? this.exprAJS(instr.valor) : this.valorPorDefecto(instr.tipoDato);
                return `${p}let ${instr.id} = ${val};`;
            }
            case 'DECLARACION_ARR_VACIO':
                return `${p}let ${instr.id} = new Array(${instr.size}).fill(${this.valorPorDefecto(instr.tipoDato)});`;
            case 'DECLARACION_ARR': {
                const vals = instr.valores.map(v => this.exprAJS(v)).join(', ');
                return `${p}let ${instr.id} = [${vals}];`;
            }
            case 'DECLARACION_ARR_DB':
                return `${p}let ${instr.id} = null;`;
            case 'ASIGNACION':
                return `${p}${instr.id} = ${this.exprAJS(instr.valor)};`;
            case 'ASIGNACION_ARR':
                return `${p}${instr.id}[${this.exprAJS(instr.indice)}] = ${this.exprAJS(instr.valor)};`;
            case 'LLAMADA_FUNCION': {
                const args = instr.args.map(a => this.exprAJS(a)).join(', ');
                return `${p}await ${instr.id}(${args});`;
            }
            case 'COMPONENTE_CALL': {
                const args = instr.args.map(a => this.exprAJS(a)).join(', ');
                return `${p}__renderComponent('${instr.id}', [${args}]);`;
            }
            case 'EXECUTE':
                return `${p}await ${this.queryAJS(instr.query)};`;
            case 'LOAD':
                return `${p}{ const __r = document.getElementById('yfera-root'); if (__r) __r.innerHTML = ''; if (typeof __arranque === 'function') await __arranque(); return; }`;
            case 'IF': {
                const lines = [`${p}if (${this.exprAJS(instr.cond)}) {`];
                instr.body.forEach(i => lines.push(this.insAJS(i, nivel + 4)));
                lines.push(`${p}}`);
                instr.elseifs.forEach(ei => {
                    lines.push(`${p}else if (${this.exprAJS(ei.cond)}) {`);
                    ei.body.forEach(i => lines.push(this.insAJS(i, nivel + 4)));
                    lines.push(`${p}}`);
                });
                if (instr.sino) {
                    lines.push(`${p}else {`);
                    instr.sino.forEach(i => lines.push(this.insAJS(i, nivel + 4)));
                    lines.push(`${p}}`);
                }
                return lines.join('\n');
            }
            case 'SWITCH': {
                const lines = [`${p}switch (${this.exprAJS(instr.expr)}) {`];
                instr.cases.forEach(c => {
                    lines.push(`${p}    case ${this.exprAJS(c.val)}:`);
                    c.body.forEach(i => lines.push(this.insAJS(i, nivel + 8)));
                    lines.push(`${p}        break;`);
                });
                if (instr.def) {
                    lines.push(`${p}    default:`);
                    instr.def.forEach(i => lines.push(this.insAJS(i, nivel + 8)));
                    lines.push(`${p}        break;`);
                }
                lines.push(`${p}}`);
                return lines.join('\n');
            }
            case 'WHILE': {
                const lines = [`${p}while (${this.exprAJS(instr.cond)}) {`];
                instr.body.forEach(i => lines.push(this.insAJS(i, nivel + 4)));
                lines.push(`${p}}`);
                return lines.join('\n');
            }
            case 'DO_WHILE': {
                const lines = [`${p}do {`];
                instr.body.forEach(i => lines.push(this.insAJS(i, nivel + 4)));
                lines.push(`${p}} while (${this.exprAJS(instr.cond)});`);
                return lines.join('\n');
            }
            case 'FOR': {
                const init = this.forAJS(instr.init, true);
                const cond = instr.cond ? this.exprAJS(instr.cond) : '';
                const step = instr.step
                    ? (instr.step.tipo === 'ASIGNACION'
                        ? `${instr.step.id} = ${this.exprAJS(instr.step.valor)}`
                        : this.exprAJS(instr.step))
                    : '';
                const lines = [`${p}for (${init}; ${cond}; ${step}) {`];
                instr.body.forEach(i => lines.push(this.insAJS(i, nivel + 4)));
                lines.push(`${p}}`);
                return lines.join('\n');
            }
            case 'BREAK':    return `${p}break;`;
            case 'CONTINUE': return `${p}continue;`;
            default: return `${p}/* instrucción no traducida: ${instr.tipo} */`;
        }
    }

    static funcionAJS(fn) {
        const params = fn.params.map(p => p.id).join(', ');
        const lines  = [`async function ${fn.id}(${params}) {`, `    try {`];
        fn.body.forEach(i => lines.push(this.insAJS(i, 8)));
        lines.push(
            `    } catch (__e) {`,
            `        alert('[YFERA] Error en ${fn.id}: ' + (__e.message || __e));`,
            `        throw __e;`,
            `    }`,
            `}`,
            `window.${fn.id} = ${fn.id};`
        );
        return lines.join('\n');
    }

    static traducir(ast) {
        if (!ast || ast.tipo !== 'PROGRAMA') {
            throw new Error('Se esperaba un nodo AST de tipo PROGRAMA');
        }
        const bloques = [];
        bloques.push(
            `/* Codigo generado */`,
            `/* Imports: ${ast.imports.map(i => i.ruta).join(', ')} */`,
            `'use strict';`
        );
        if (ast.globales && ast.globales.length > 0) {
            bloques.push(ast.globales.map(d => this.insAJS(d, 0)).join('\n'));
        }
        if (ast.funciones && ast.funciones.length > 0) {
            bloques.push(ast.funciones.map(f => this.funcionAJS(f)).join('\n\n'));
        }
        if (ast.main) {
            const mainLines = ['/* -- Main -- */', 'async function __main() {', '    try {'];
            ast.main.forEach(i => mainLines.push(this.insAJS(i, 8)));
            mainLines.push(
                '    } catch (__e) {',
                "        alert('[YFERA] Error en main: ' + (__e.message || __e));",
                '    }', '}'
            );
            bloques.push(mainLines.join('\n'));
        }
        const arrDb = ast.globales ? ast.globales.filter(d => d.tipo === 'DECLARACION_ARR_DB') : [];
        const arranqueLines = [
            'async function __arranque() {',
            '    try {'
        ];
        if (arrDb.length > 0) {
            arrDb.forEach(d => {
                arranqueLines.push(`        ${d.id} = ${this.queryAJS(d.query)};`);
            });
        }
        if (ast.main) arranqueLines.push('        await __main();');
        arranqueLines.push(
            '    } catch (__e) {',
            "        alert('[YFERA] Error de arranque: ' + (__e.message || __e));",
            '    }', '}'
        );
        bloques.push(arranqueLines.join('\n'));
        return bloques.join('\n\n');
    }
}

module.exports = TraductorJS;