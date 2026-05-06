class TraductorJS {
    static traducir(ast) {
        if (!ast || ast.tipo !== 'PROGRAMA') return '';

        let jsCode = `// ==========================================\n`;
        jsCode += `// ARCHIVO PRINCIPAL GENERADO POR YFERA IDE\n`;
        jsCode += `// ==========================================\n\n`;

        // 1. Imports
        if (ast.imports && ast.imports.length > 0) {
            jsCode += `// --- IMPORTS ---\n`;
            ast.imports.forEach(imp => {
                // Removemos las comillas para tener la ruta limpia
                const ruta = imp.ruta.replace(/"/g, '');
                jsCode += `await YferaAPI.importar('${ruta}');\n`;
            });
            jsCode += `\n`;
        }

        // 2. Variables Globales
        if (ast.globales && ast.globales.length > 0) {
            jsCode += `// --- VARIABLES GLOBALES ---\n`;
            ast.globales.forEach(glob => {
                jsCode += this.procesarNodo(glob) + '\n';
            });
            jsCode += `\n`;
        }

        // 3. Funciones
        if (ast.funciones && ast.funciones.length > 0) {
            jsCode += `// --- FUNCIONES ---\n`;
            ast.funciones.forEach(func => {
                jsCode += this.procesarNodo(func) + '\n\n';
            });
        }

        // 4. Bloque Main
        if (ast.main) {
            jsCode += `// --- PUNTO DE ENTRADA (MAIN) ---\n`;
            jsCode += `async function main() {\n`;
            ast.main.forEach(instruccion => {
                const instJS = this.procesarNodo(instruccion);
                jsCode += `  ${instJS.replace(/\n/g, '\n  ')}\n`;
            });
            jsCode += `}\n\n`;
            
            // Ejecución automática del main al final del script
            jsCode += `// Iniciar ejecución\nawait main();\n`;
        }

        // Envolvemos todo en una función asíncrona autoejecutable (IIFE)
        // Esto permite usar 'await' libremente dentro del script en cualquier navegador
        return `(async function() {\n  try {\n    ${jsCode.replace(/\n/g, '\n    ')}\n  } catch(error) {\n    console.error("Error en la ejecución:", error);\n    alert("Error de ejecución: " + error.message);\n  }\n})();`;
    }

    static procesarNodo(nodo) {
        if (!nodo) return '';

        switch (nodo.tipo) {
            // Declaraciones
            case 'DECLARACION': 
                return `let ${nodo.id} = ${this.evaluarExpresion(nodo.valor)};`;
            case 'DECLARACION_ARR_VACIO': 
                return `let ${nodo.id} = new Array(${this.evaluarExpresion(nodo.size)});`;
            case 'DECLARACION_ARR': 
                return `let ${nodo.id} = [${nodo.valores.map(v => this.evaluarExpresion(v)).join(', ')}];`;
            case 'DECLARACION_ARR_DB': 
                return `let ${nodo.id} = await YferaAPI.execute(${this.limpiarQuery(nodo.query)});`;
            
            // Funciones
            case 'FUNCION':
                // Todas las funciones son async para soportar 'execute' y 'load'
                const params = nodo.params.map(p => p.id).join(', ');
                const body = nodo.body.map(b => this.procesarNodo(b)).join('\n  ');
                return `async function ${nodo.id}(${params}) {\n  ${body}\n}`;
            
            // Comandos Especiales
            case 'EXECUTE':
                return `await YferaAPI.execute(${this.limpiarQuery(nodo.query)});`;
            case 'LOAD':
                return `await YferaAPI.load(${this.evaluarExpresion(nodo.ruta)});`;
            case 'COMPONENTE_CALL':
                const args = nodo.args.map(a => this.evaluarExpresion(a)).join(', ');
                return `YferaAPI.renderComponent('${nodo.id}', [${args}]);`;
            
            // Asignaciones
            case 'ASIGNACION':
                return `${nodo.id} = ${this.evaluarExpresion(nodo.valor)};`;
            case 'ASIGNACION_ARR':
                return `${nodo.id}[${this.evaluarExpresion(nodo.indice)}] = ${this.evaluarExpresion(nodo.valor)};`;

            // Lógica de Control
            case 'IF': return this.traducirIf(nodo);
            case 'SWITCH': return this.traducirSwitch(nodo);
            case 'WHILE':
                return `while (${this.evaluarExpresion(nodo.cond)}) {\n  ${nodo.body.map(b => this.procesarNodo(b)).join('\n  ')}\n}`;
            case 'DO_WHILE':
                return `do {\n  ${nodo.body.map(b => this.procesarNodo(b)).join('\n  ')}\n} while (${this.evaluarExpresion(nodo.cond)});`;
            case 'FOR':
                const init = this.procesarNodo(nodo.init).replace(';', ''); // Quitamos el ; extra
                const cond = this.evaluarExpresion(nodo.cond);
                const step = this.procesarNodo(nodo.step).replace(';', '');
                return `for (${init}; ${cond}; ${step}) {\n  ${nodo.body.map(b => this.procesarNodo(b)).join('\n  ')}\n}`;
            
            case 'BREAK': return `break;`;
            case 'CONTINUE': return `continue;`;

            default: return `/* Nodo no soportado: ${nodo.tipo} */`;
        }
    }

    // --- MÉTODOS DE TRADUCCIÓN ESPECÍFICOS ---

    static traducirIf(nodo) {
        let js = `if (${this.evaluarExpresion(nodo.cond)}) {\n  ${nodo.body.map(b => this.procesarNodo(b)).join('\n  ')}\n}`;
        
        if (nodo.elseifs && nodo.elseifs.length > 0) {
            nodo.elseifs.forEach(eif => {
                js += ` else if (${this.evaluarExpresion(eif.cond)}) {\n  ${eif.body.map(b => this.procesarNodo(b)).join('\n  ')}\n}`;
            });
        }
        if (nodo.sino) {
            js += ` else {\n  ${nodo.sino.map(b => this.procesarNodo(b)).join('\n  ')}\n}`;
        }
        return js;
    }

    static traducirSwitch(nodo) {
        let js = `switch (${this.evaluarExpresion(nodo.expr)}) {\n`;
        nodo.cases.forEach(c => {
            js += `  case ${this.evaluarExpresion(c.val)}:\n    ${c.body.map(b => this.procesarNodo(b)).join('\n    ')}\n`;
        });
        if (nodo.def) {
            js += `  default:\n    ${nodo.def.map(b => this.procesarNodo(b)).join('\n    ')}\n`;
        }
        return js + `}`;
    }

    static evaluarExpresion(expr) {
        if (expr === null || expr === undefined) return 'null';
        if (typeof expr === 'number' || typeof expr === 'boolean') return expr;
        if (typeof expr === 'string') return expr; // Cadenas o caracteres ('a', "Hola")

        if (expr.tipo === 'ID') return expr.val;
        if (expr.tipo === 'ACCESO_ARR') return `${expr.id}[${this.evaluarExpresion(expr.indice)}]`;

        if (expr.op) {
            if (expr.op === '!') return `!${this.evaluarExpresion(expr.der)}`;
            if (expr.op === 'UMINUS') return `-${this.evaluarExpresion(expr.der)}`;
            if (expr.op === '++') return `${this.evaluarExpresion(expr.izq)}++`; // i++
            
            return `${this.evaluarExpresion(expr.izq)} ${expr.op} ${this.evaluarExpresion(expr.der)}`;
        }
        return expr;
    }

    /**
     * Convierte las variables del lenguaje Y ($variable) en interpolación de JavaScript (${variable})
     */
    static limpiarQuery(queryStr) {
        // Ejemplo: `SELECT * WHERE id = $id` -> `SELECT * WHERE id = ${id}`
        return queryStr.replace(/\$([a-zA-Z0-9_]+)/g, '${$1}');
    }
}

module.exports = TraductorJS;