class TraductorHTML {
    /**
     * Inicia la traducción recibiendo el AST de componentes.
     */
    static traducir(ast) {
        if (!ast || !Array.isArray(ast)) return '';
        
        let htmlFinal = '';
        for (const componente of ast) {
            htmlFinal += this.procesarNodo(componente) + '\n\n';
        }
        return htmlFinal;
    }

    /**
     * Enrutador principal: decide qué función llama según el 'tipo' del nodo.
     */
    static procesarNodo(nodo) {
        if (!nodo) return '';
        
        // Si es un arreglo (usualmente el cuerpo de una sección o if), procesamos cada elemento
        if (Array.isArray(nodo)) {
            return nodo.map(n => this.procesarNodo(n)).join('\n');
        }

        switch (nodo.tipo) {
            case 'COMPONENTE_DEF': return this.traducirComponente(nodo);
            case 'SECTION': return this.traducirSeccion(nodo);
            case 'TABLA': return this.traducirTabla(nodo);
            case 'CELDA': return this.procesarNodo(nodo.contenido); // Celda es solo un wrapper
            case 'TEXTO': return this.traducirTexto(nodo);
            case 'IMG': return this.traducirImg(nodo);
            case 'FORM': return this.traducirForm(nodo);
            case 'INPUT_TEXT':
            case 'INPUT_NUMBER':
            case 'INPUT_BOOL': return this.traducirInput(nodo);
            case 'IF': return this.traducirIf(nodo);
            case 'FOR_EACH':
            case 'FOR_TRACK': return this.traducirFor(nodo);
            case 'SWITCH': return this.traducirSwitch(nodo);
            default: return `<!-- Nodo desconocido: ${nodo.tipo} -->`;
        }
    }

    // ==========================================
    // TRADUCCIONES ESTRUCTURALES
    // ==========================================

    static traducirComponente(nodo) {
        const bodyHtml = this.procesarNodo(nodo.body);
        return `<div id="${nodo.id}" class="componente">\n  ${bodyHtml.replace(/\n/g, '\n  ')}\n</div>`;
    }

    static traducirSeccion(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        const bodyHtml = this.procesarNodo(nodo.contenido);
        return `<section${clases}>\n  ${bodyHtml.replace(/\n/g, '\n  ')}\n</section>`;
    }

    static traducirTabla(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        let html = `<table${clases}>\n  <tbody>\n`;
        
        nodo.filas.forEach(fila => {
            html += `    <tr>\n`;
            fila.forEach(columna => {
                const celdaHtml = this.procesarNodo(columna.contenido);
                html += `      <td>\n        ${celdaHtml.replace(/\n/g, '\n        ')}\n      </td>\n`;
            });
            html += `    </tr>\n`;
        });
        
        html += `  </tbody>\n</table>`;
        return html;
    }

    static traducirTexto(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        const textoLimpio = this.limpiarValor(nodo.val);
        return `<p${clases}>${textoLimpio}</p>`;
    }

    static traducirImg(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        // Asumimos que el primer valor es la URL y el segundo (si existe) es el width/alt
        const src = nodo.vals[0] ? this.limpiarValor(nodo.vals[0]) : '';
        return `<img src="${src}"${clases} alt="Imagen" />`;
    }

    // ==========================================
    // TRADUCCIONES DE FORMULARIOS
    // ==========================================

    static traducirForm(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        const bodyHtml = this.procesarNodo(nodo.body);
        
        let submitHtml = '';
        if (nodo.submit) {
            const btnClases = this.obtenerClases(nodo.submit.estilos);
            const labelBtn = this.limpiarValor(nodo.submit.label);
            
            // Construimos la llamada a la función (si tiene extras)
            let onClick = '';
            if (nodo.submit.extra && nodo.submit.extra.func) {
                const args = nodo.submit.extra.refs.join(', ');
                onClick = ` onclick="${nodo.submit.extra.func}(${args})"`;
            }
            
            submitHtml = `\n  <button type="button"${btnClases}${onClick}>${labelBtn}</button>`;
        }

        return `<form${clases}>\n  ${bodyHtml.replace(/\n/g, '\n  ')}${submitHtml}\n</form>`;
    }

    static traducirInput(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        let type = 'text';
        if (nodo.tipo === 'INPUT_NUMBER') type = 'number';
        if (nodo.tipo === 'INPUT_BOOL') type = 'checkbox';

        let id = '', value = '', placeholder = '';

        // Extraer propiedades (id, label, value)
        nodo.props.forEach(prop => {
            if (prop.id) id = ` id="${this.limpiarValor(prop.id)}"`;
            if (prop.value) value = ` value="${this.limpiarValor(prop.value)}"`;
            if (prop.label) placeholder = ` placeholder="${this.limpiarValor(prop.label)}"`;
        });

        return `<input type="${type}"${id}${clases}${value}${placeholder} />`;
    }

    // ==========================================
    // TRADUCCIONES LÓGICAS (Wrappers)
    // ==========================================

    static traducirIf(nodo) {
        const condLimpia = this.evaluarExpresion(nodo.cond);
        const bodyHtml = this.procesarNodo(nodo.body);
        
        let html = `<template data-if="${condLimpia}">\n  ${bodyHtml.replace(/\n/g, '\n  ')}\n</template>`;
        
        if (nodo.elseifs && nodo.elseifs.length > 0) {
            nodo.elseifs.forEach(eif => {
                const condElif = this.evaluarExpresion(eif.cond);
                html += `\n<template data-elseif="${condElif}">\n  ${this.procesarNodo(eif.body).replace(/\n/g, '\n  ')}\n</template>`;
            });
        }

        if (nodo.sino) {
            html += `\n<template data-else>\n  ${this.procesarNodo(nodo.sino).replace(/\n/g, '\n  ')}\n</template>`;
        }
        
        return html;
    }

    static traducirFor(nodo) {
        const bodyHtml = this.procesarNodo(nodo.body);
        let estructura = '';

        if (nodo.tipo === 'FOR_EACH') {
            estructura = `data-foreach="${nodo.iterador} in ${nodo.coleccion}"`;
        } else {
            // FOR TRACK
            const varsStr = nodo.vars.map(v => `${v.id}:${v.col}`).join(', ');
            estructura = `data-fortrack="${varsStr}" data-track="${nodo.track}"`;
        }

        let html = `<template ${estructura}>\n  ${bodyHtml.replace(/\n/g, '\n  ')}\n</template>`;
        
        if (nodo.empty) {
            html += `\n<template data-forempty>\n  ${this.procesarNodo(nodo.empty).replace(/\n/g, '\n  ')}\n</template>`;
        }
        return html;
    }

    static traducirSwitch(nodo) {
        const expr = this.evaluarExpresion(nodo.expr);
        let html = `<div data-switch="${expr}">\n`;
        
        nodo.cases.forEach(c => {
            const valCase = this.limpiarValor(c.val);
            html += `  <template data-case="${valCase}">\n    ${this.procesarNodo(c.body).replace(/\n/g, '\n    ')}\n  </template>\n`;
        });

        if (nodo.def) {
            html += `  <template data-default>\n    ${this.procesarNodo(nodo.def).replace(/\n/g, '\n    ')}\n  </template>\n`;
        }
        
        return html + `</div>`;
    }

    // ==========================================
    // MÉTODOS DE UTILIDAD
    // ==========================================

    static obtenerClases(arrayEstilos) {
        if (!arrayEstilos || arrayEstilos.length === 0) return '';
        return ` class="${arrayEstilos.join(' ')}"`;
    }

    static limpiarValor(val) {
        if (typeof val === 'string') {
            // Remover comillas iniciales y finales si es un literal de cadena
            return val.replace(/(^"|"$)/g, '');
        }
        if (typeof val === 'object' && val.id && val.index !== undefined) {
            // Variables con acceso a índice, ej: $urls[1]
            return `{{${val.id}[${val.index}]}}`;
        }
        // Si es una variable, se envuelve para template
        if (typeof val === 'string' && val.startsWith('$')) {
            return `{{${val}}}`;
        }
        return val; // true, false, numeros
    }

    static evaluarExpresion(expr) {
        if (!expr) return '';
        if (expr.op) {
            if (expr.izq) {
                return `${this.evaluarExpresion(expr.izq)} ${expr.op} ${this.evaluarExpresion(expr.der)}`;
            } else {
                return `${expr.op}${this.evaluarExpresion(expr.der)}`;
            }
        }
        return this.limpiarValor(expr);
    }
}

module.exports = TraductorHTML;