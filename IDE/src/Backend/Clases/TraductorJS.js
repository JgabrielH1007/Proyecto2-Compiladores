class TraductorJS {
    static traducir(ast) {
        if (!ast || ast.tipo !== 'PROGRAMA') return '';
 
        let jsCode = `/* CÓDIGO JS GENERADO */\n\n`;
        jsCode += `const executeDB = async (query) => { \n  console.log("Ejecutando BD:", query);\n  return []; \n};\n`;
        jsCode += `const loadFile = async (route) => { location.reload(); };\n\n`;
        jsCode += `const renderComponent = (name, args) => { \n`;
        jsCode += `  const templateDef = document.getElementById(name);\n`;
        jsCode += `  if (!templateDef) return;\n\n`;
        jsCode += `  let htmlStr = templateDef.innerHTML;\n\n`;
        
        jsCode += `  const regexVar = /\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}/g;\n`;
        jsCode += `  const matches = [...htmlStr.matchAll(regexVar)];\n`;
        jsCode += `  const nombresEnOrden = [...new Set(matches.map(m => m[1]))];\n\n`;
        
        jsCode += `  nombresEnOrden.forEach((nombreVar, i) => {\n`;
        jsCode += `    if (args[i] !== undefined) {\n`;
        jsCode += `      let valor = args[i];\n`;
        
        jsCode += `      /* Si el argumento es una función, la exponemos globalmente */\n`;
        jsCode += `      if (typeof valor === 'function') {\n`;
        jsCode += `        window[nombreVar] = function(event) {\n`;
        jsCode += `          if(event) event.preventDefault(); /* Evita que el FORM recargue la página */\n`;
        jsCode += `          return valor();\n`;
        jsCode += `        };\n`;
        jsCode += `        valor = nombreVar;\n`;
        jsCode += `      }\n`;
        
        jsCode += `      const r = new RegExp('\\\\{\\\\{\\\\s*' + nombreVar + '\\\\s*\\\\}\\\\}', 'g');\n`;
        jsCode += `      htmlStr = htmlStr.replace(r, valor);\n`;
        jsCode += `    }\n`;
        jsCode += `  });\n\n`;
        
        jsCode += `  const parser = new DOMParser();\n`;
        jsCode += `  const doc = parser.parseFromString(htmlStr, 'text/html');\n\n`;
        
        jsCode += `  /* PROCESAMIENTO DE IF */\n`;
        jsCode += `  doc.querySelectorAll('template[data-if]').forEach(tempIf => {\n`;
        jsCode += `    const condicion = tempIf.getAttribute('data-if') === 'true';\n`;
        jsCode += `    const parent = tempIf.parentElement;\n`;
        jsCode += `    if (condicion) {\n`;
        jsCode += `      tempIf.replaceWith(document.importNode(tempIf.content, true));\n`;
        jsCode += `    } else {\n`;
        jsCode += `      const tempElse = parent.querySelector('template[data-else]');\n`;
        jsCode += `      if (tempElse) {\n`;
        jsCode += `        tempElse.replaceWith(document.importNode(tempElse.content, true));\n`;
        jsCode += `      }\n`;
        jsCode += `      tempIf.remove();\n`;
        jsCode += `    }\n`;
        jsCode += `  });\n\n`;

        jsCode += `  /* PROCESAMIENTO DE SWITCH */\n`;
        jsCode += `  doc.querySelectorAll('[data-switch]').forEach(switchCont => {\n`;
        jsCode += `    const valorSwitch = switchCont.getAttribute('data-switch');\n`;
        jsCode += `    let target = switchCont.querySelector(\`template[data-case="\${valorSwitch}"]\`);\n`;
        jsCode += `    if (!target) target = switchCont.querySelector('template[data-default]');\n`;
        jsCode += `    if (target) {\n`;
        jsCode += `      switchCont.replaceWith(document.importNode(target.content, true));\n`;
        jsCode += `    } else {\n`;
        jsCode += `      switchCont.remove();\n`;
        jsCode += `    }\n`;
        jsCode += `  });\n\n`;
        
        jsCode += `  const root = document.getElementById('yfera-root');\n`;
        jsCode += `  if(root) root.innerHTML += doc.body.innerHTML;\n`;
        jsCode += `};\n\n`;
 
        if (ast.imports && ast.imports.length > 0) {
            ast.imports.forEach(imp => {
                const ruta = imp.ruta.replace(/"/g, '');
                jsCode += `// Importado: ${ruta}\n`;
            });
            jsCode += `\n`;
        }
 
        if (ast.globales && ast.globales.length > 0) {
            ast.globales.forEach(glob => {
                jsCode += this.procesarNodo(glob) + '\n';
            });
            jsCode += `\n`;
        }
 
        if (ast.funciones && ast.funciones.length > 0) {
            ast.funciones.forEach(func => {
                jsCode += this.procesarNodo(func) + '\n\n';
            });
        }
 
        if (ast.main) {
            jsCode += `async function main() {\n`;
            ast.main.forEach(instruccion => {
                const instJS = this.procesarNodo(instruccion);
                jsCode += this.indentar(instJS, '  ') + '\n';
            });
            jsCode += `}\n\n`;
            jsCode += `// Iniciar ejecución\nawait main();\n`;
        }
 
        const inner = jsCode.split('\n').map(l => '    ' + l).join('\n');
        
        // Bloque general autoejecutable con manejo de alertas según las reglas
        return `(async function() {\n  try {\n${inner}\n  } catch(error) {\n    console.error("Error en la ejecución:", error);\n    alert("Error de ejecución o Base de Datos: " + error.message);\n  }\n})();`;
    }
 
    static indentar(codigo, prefijo) {
        if (!codigo) return '';
        const lineas = codigo.split('\n');
        return lineas.map((l, i) => i === 0 ? prefijo + l : prefijo + l).join('\n');
    }
 
    static procesarNodo(nodo) {
        if (!nodo) return '';
 
        switch (nodo.tipo) {
 
            case 'DECLARACION':
                if (nodo.valor === null || nodo.valor === undefined) {
                    return `let ${nodo.id};`;
                }
                return `let ${nodo.id} = ${this.evaluarExpresion(nodo.valor)};`;
 
            case 'DECLARACION_ARR_VACIO':
                return `let ${nodo.id} = new Array(${this.evaluarExpresion(nodo.size)});`;
 
            case 'DECLARACION_ARR':
                return `let ${nodo.id} = [${nodo.valores.map(v => this.evaluarExpresion(v)).join(', ')}];`;
 
            case 'DECLARACION_ARR_DB':
                return `let ${nodo.id} = await executeDB(${this.limpiarQuery(nodo.query)});`;
 
            case 'FUNCION': {
                const params = nodo.params.map(p => p.id).join(', ');
                const bodyLines = nodo.body.map(b => this.procesarNodo(b));
                const body = bodyLines.map(l => '  ' + l.split('\n').join('\n  ')).join('\n');
                return `async function ${nodo.id}(${params}) {\n${body}\n}`;
            }
 
            case 'LLAMADA_FUNCION': {
                const args = nodo.args.map(a => this.evaluarExpresion(a)).join(', ');
                return `await ${nodo.id}(${args});`;
            }
 
            case 'EXECUTE':
                return `await executeDB(${this.limpiarQuery(nodo.query)});`;
 
            case 'LOAD':
                return `await loadFile(${this.evaluarExpresion(nodo.ruta)});`;
 
            case 'COMPONENTE_CALL': {
                const args = nodo.args.map(a => this.evaluarExpresion(a)).join(', ');
                return `renderComponent('${nodo.id}', [${args}]);`;
            }
 
            case 'ASIGNACION':
                return `${nodo.id} = ${this.evaluarExpresion(nodo.valor)};`;
 
            case 'ASIGNACION_ARR':
                return `${nodo.id}[${this.evaluarExpresion(nodo.indice)}] = ${this.evaluarExpresion(nodo.valor)};`;
 
            case 'IF':
                return this.traducirIf(nodo);
 
            case 'SWITCH':
                return this.traducirSwitch(nodo);
 
            case 'WHILE': {
                const cond = this.evaluarExpresion(nodo.cond);
                const body = this.traducirBloque(nodo.body);
                return `while (${cond}) {\n${body}\n}`;
            }
 
            case 'DO_WHILE': {
                const body = this.traducirBloque(nodo.body);
                const cond = this.evaluarExpresion(nodo.cond);
                return `do {\n${body}\n} while (${cond});`;
            }
 
            case 'FOR': {
                const init = this.procesarNodo(nodo.init).replace(/;$/, '');
                const cond = this.evaluarExpresion(nodo.cond);
                const step = this.procesarNodo(nodo.step).replace(/;$/, '');
                const body = this.traducirBloque(nodo.body);
                return `for (${init}; ${cond}; ${step}) {\n${body}\n}`;
            }
 
            case 'BREAK':    return `break;`;
            case 'CONTINUE': return `continue;`;
 
            default:
                return `/* Nodo no soportado: ${nodo.tipo} */`;
        }
    }
 
    static traducirBloque(instrucciones) {
        if (!instrucciones || instrucciones.length === 0) return '';
        return instrucciones
            .map(b => this.procesarNodo(b))
            .map(l => '  ' + l.split('\n').join('\n  '))
            .join('\n');
    }
 
    static traducirIf(nodo) {
        const cond  = this.evaluarExpresion(nodo.cond);
        const body  = this.traducirBloque(nodo.body);
        let js = `if (${cond}) {\n${body}\n}`;
 
        if (nodo.elseifs && nodo.elseifs.length > 0) {
            nodo.elseifs.forEach(eif => {
                const ec = this.evaluarExpresion(eif.cond);
                const eb = this.traducirBloque(eif.body);
                js += ` else if (${ec}) {\n${eb}\n}`;
            });
        }
 
        if (nodo.sino) {
            const sb = this.traducirBloque(nodo.sino);
            js += ` else {\n${sb}\n}`;
        }
 
        return js;
    }
 
    static traducirSwitch(nodo) {
        const expr = this.evaluarExpresion(nodo.expr);
        let js = `switch (${expr}) {\n`;
 
        if (nodo.cases && nodo.cases.length > 0) {
            nodo.cases.forEach(c => {
                const val  = this.evaluarExpresion(c.val);
                const body = this.traducirBloque(c.body);
                js += `  case ${val}:\n${body ? body.split('\n').map(l => '  ' + l).join('\n') + '\n' : ''}`;
            });
        }
 
        if (nodo.def) {
            const defBody = this.traducirBloque(nodo.def);
            js += `  default:\n${defBody ? defBody.split('\n').map(l => '  ' + l).join('\n') + '\n' : ''}`;
        }
 
        return js + `}`;
    }
 
    static evaluarExpresion(expr) {
        if (expr === null || expr === undefined) return 'null';
 
        if (typeof expr === 'number')  return String(expr);
        if (typeof expr === 'boolean') return String(expr);
 
        if (typeof expr === 'string') {
            if (expr.toLowerCase() === 'true' || expr.toLowerCase() === 'false') {
                return expr.toLowerCase();
            }
            return expr;
        }
 
        if (expr.tipo === 'ID') return expr.val;
 
        if (expr.tipo === 'ACCESO_ARR') {
            return `${expr.id}[${this.evaluarExpresion(expr.indice)}]`;
        }
 
        if (expr.op) {
            if (expr.op === '!')      return `!${this.evaluarExpresion(expr.der)}`;
            if (expr.op === 'UMINUS') return `-${this.evaluarExpresion(expr.der)}`;
            return `${this.evaluarExpresion(expr.izq)} ${expr.op} ${this.evaluarExpresion(expr.der)}`;
        }
 
        return String(expr);
    }
 
    static limpiarQuery(queryStr) {
        let limpio = queryStr.replace(/^`|`$/g, '');
        limpio = limpio.replace(/\$([a-zA-Z0-9_]+)/g, '${$1}');
        return '`' + limpio + '`';
    }
}
 
module.exports = TraductorJS;