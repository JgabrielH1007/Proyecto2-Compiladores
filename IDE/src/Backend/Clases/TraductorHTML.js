class TraductorHTML {
 
    static traducir(ast) {
        if (!ast || !Array.isArray(ast)) return '';
 
        let htmlFinal = '';
        for (const componente of ast) {
            htmlFinal += this.procesarNodo(componente) + '\n\n';
        }
        return htmlFinal;
    }
 
    static procesarNodo(nodo) {
        if (!nodo) return '';
 
        if (Array.isArray(nodo)) {
            return nodo.map(n => this.procesarNodo(n)).join('\n');
        }
 
        switch (nodo.tipo) {
            case 'COMPONENTE_DEF': return this.traducirComponente(nodo);
            case 'SECTION':       return this.traducirSeccion(nodo);
            case 'TABLA':         return this.traducirTabla(nodo);
            case 'CELDA':         return this.procesarNodo(nodo.contenido);
            case 'TEXTO':         return this.traducirTexto(nodo);
            case 'IMG':           return this.traducirImg(nodo);
            case 'FORM':          return this.traducirForm(nodo);
            case 'INPUT_TEXT':
            case 'INPUT_NUMBER':
            case 'INPUT_BOOL':    return this.traducirInput(nodo);
            case 'IF':            return this.traducirIf(nodo);
            case 'FOR_EACH':
            case 'FOR_TRACK':     return this.traducirFor(nodo);
            case 'SWITCH':        return this.traducirSwitch(nodo);
            case 'INVOKE':        return this.traducirInvocacion(nodo);
            default: return `<!-- Nodo desconocido: ${nodo.tipo} -->`;
        }
    }
 
    static traducirComponente(nodo) {
        const bodyHtml = this.procesarNodo(nodo.body);
        return `<div id="${nodo.id}" class="componente">\n  ${this.indentar(bodyHtml)}\n</div>`;
    }
 
    static traducirSeccion(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        const bodyHtml = this.procesarNodo(nodo.contenido);
        return `<section${clases}>\n  ${this.indentar(bodyHtml)}\n</section>`;
    }
 
    static traducirTabla(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        let html = `<table${clases}>\n  <tbody>\n`;
 
        nodo.filas.forEach(fila => {
            html += `    <tr>\n`;
            fila.forEach(columna => {
                const celdaHtml = this.procesarNodo(columna.contenido);
                html += `      <td>\n        ${this.indentar(celdaHtml, '        ')}\n      </td>\n`;
            });
            html += `    </tr>\n`;
        });
 
        html += `  </tbody>\n</table>`;
        return html;
    }
 
    static traducirTexto(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        const textoLimpio = this.procesarTexto(nodo.val);
        if (textoLimpio.includes('\n')) {
            return `<p${clases}>${textoLimpio}</p>`;
        }
        return `<p${clases}>${textoLimpio}</p>`;
    }
 
    static traducirImg(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
 
        if (nodo.vals.length === 1) {
            const src = this.resolverValor(nodo.vals[0]);
            return `<img src="${src}"${clases} alt="Imagen" />`;
        }
 
        const clasesCarrusel = this.obtenerClases(nodo.estilos);
        let html = `<div class="carousel${nodo.estilos && nodo.estilos.length ? ' ' + nodo.estilos.join(' ') : ''}">\n`;
        nodo.vals.forEach(val => {
            const src = this.resolverValor(val);
            html += `  <img data-src="${src}" alt="Imagen" />\n`;
        });
        html += `</div>`;
        return html;
    }
 
    static traducirForm(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        const bodyHtml = this.procesarNodo(nodo.body);
 
        let submitHtml = '';
        if (nodo.submit) {
            const btnClases = this.obtenerClases(nodo.submit.estilos);
            let labelBtn = 'Enviar';
            let onClick = '';
 
            if (nodo.submit.props && Array.isArray(nodo.submit.props)) {
                const propLabel = nodo.submit.props.find(p => p.tipo === 'LABEL');
                const propFn    = nodo.submit.props.find(p => p.tipo === 'FUNCTION');
 
                if (propLabel) {
                    labelBtn = this.procesarTexto(propLabel.val.replace(/(^"|"$)/g, ''));
                }
 
                if (propFn) {
                    const fnNombre = this.resolverValor(propFn.fn);
                    const args = propFn.refs.map(r => {
                        return `document.getElementById('${r.replace('@', '')}').value`;
                    }).join(', ');
                    onClick = ` onclick="${fnNombre}(${args})"`;
                }
            }
 
            submitHtml = `\n  <button type="submit"${btnClases}${onClick}>${labelBtn}</button>`;
        }
 
        return `<form${clases}>\n  ${this.indentar(bodyHtml)}${submitHtml}\n</form>`;
    }
 
    static traducirInput(nodo) {
        const clases = this.obtenerClases(nodo.estilos);
        let type = 'text';
        if (nodo.tipo === 'INPUT_NUMBER') type = 'number';
        if (nodo.tipo === 'INPUT_BOOL')   type = 'checkbox';
 
        let idAttr    = '';
        let valueAttr = '';
        let labelHtml = '';
 
        if (nodo.props && Array.isArray(nodo.props)) {
            nodo.props.forEach(prop => {
                if (prop.tipo === 'id') {
                    const idVal = this.resolverValor(prop.val);
                    idAttr = ` id="${idVal}" name="${idVal}"`;
                }
                if (prop.tipo === 'value') {
                    const v = this.resolverValor(prop.val);
                    if (type === 'checkbox') {
                        valueAttr = v === 'true' ? ' checked' : '';
                    } else {
                        valueAttr = ` value="${v}"`;
                    }
                }
                if (prop.tipo === 'label') {
                    const labelVal = this.procesarTexto(this.resolverValor(prop.val));
                    labelHtml = `<label>${labelVal}</label>\n`;
                }
            });
 
            if (idAttr && labelHtml) {
                const idMatch = idAttr.match(/id="([^"]+)"/);
                if (idMatch) {
                    labelHtml = labelHtml.replace('<label>', `<label for="${idMatch[1]}">`);
                }
            }
        }
 
        return `${labelHtml}<input type="${type}"${idAttr}${clases}${valueAttr} />`;
    }
 
    static traducirIf(nodo) {
        const condLimpia = this.evaluarExpresion(nodo.cond);
        const bodyHtml   = this.procesarNodo(nodo.body);
 
        let html = `<template data-if="${condLimpia}">\n  ${this.indentar(bodyHtml)}\n</template>`;
 
        if (nodo.elseifs && nodo.elseifs.length > 0) {
            nodo.elseifs.forEach(eif => {
                const condElif = this.evaluarExpresion(eif.cond);
                html += `\n<template data-elseif="${condElif}">\n  ${this.indentar(this.procesarNodo(eif.body))}\n</template>`;
            });
        }
 
        if (nodo.sino) {
            html += `\n<template data-else>\n  ${this.indentar(this.procesarNodo(nodo.sino))}\n</template>`;
        }
 
        return html;
    }
 
    static traducirFor(nodo) {
        const bodyHtml = this.procesarNodo(nodo.body);
        let estructura = '';
 
        if (nodo.tipo === 'FOR_EACH') {
            estructura = `data-foreach="${nodo.iterador} in ${nodo.coleccion}"`;
        } else {
            const varsStr = nodo.vars.map(v => `${v.iter}:${v.col}`).join(', ');
            estructura = `data-fortrack="${varsStr}" data-track="${nodo.track}"`;
        }
 
        let html = `<template ${estructura}>\n  ${this.indentar(bodyHtml)}\n</template>`;
 
        if (nodo.empty) {
            html += `\n<template data-forempty>\n  ${this.indentar(this.procesarNodo(nodo.empty))}\n</template>`;
        }
 
        return html;
    }
 
    static traducirSwitch(nodo) {
        const expr = this.evaluarExpresion(nodo.expr);
        let html = `<div data-switch="${expr}">\n`;
 
        nodo.cases.forEach(c => {
            const valCase = this.resolverValor(c.val);
            html += `  <template data-case="${valCase}">\n    ${this.indentar(this.procesarNodo(c.body), '    ')}\n  </template>\n`;
        });
 
        if (nodo.def) {
            html += `  <template data-default>\n    ${this.indentar(this.procesarNodo(nodo.def), '    ')}\n  </template>\n`;
        }
 
        return html + `</div>`;
    }
 
    static traducirInvocacion(nodo) {
        const argsStr = nodo.args.map(a => this.resolverValor(a)).join(', ');
        return `<div data-component="${nodo.id}" data-args="${argsStr}"></div>`;
    }
 

    static obtenerClases(arrayEstilos) {
        if (!arrayEstilos || arrayEstilos.length === 0) return '';
        return ` class="${arrayEstilos.join(' ')}"`;
    }
 
    static resolverValor(val) {
        if (val === null || val === undefined) return '';
 
        if (typeof val === 'object' && val.tipo) {
            switch (val.tipo) {
                case 'VAR':
                    return `{{${val.val.replace(/^\$/, '')}}}`;
                case 'STR':
                    return this.procesarTexto(val.val.replace(/(^"|"$)/g, ''));
                case 'NUM':
                    return String(val.val);
                case 'BOOL':
                    return String(val.val);
                case 'ARR_NUM_IDX':
                    return `{{${val.id.replace(/^\$/, '')}[${val.idx}]}}`;
                case 'ARR_VAR_IDX':
                    return `{{${val.id.replace(/^\$/, '')}[${val.idx.replace(/^\$/, '')}]}}`;
            }
        }
 
        if (typeof val === 'string') {
            return this.procesarTexto(val.replace(/(^"|"$)/g, ''));
        }
 
        if (typeof val === 'boolean' || typeof val === 'number') {
            return String(val);
        }
 
        return '';
    }
 
    static procesarTexto(texto) {
        if (typeof texto !== 'string') return String(texto ?? '');
 
        texto = texto.replace(/`([^`]+)`/g, (_, expr) => {
            const exprLimpia = expr.replace(/\$([a-zA-Z0-9_]+)/g, '$1');
            return `{{${exprLimpia.trim()}}}`;
        });
 
        texto = texto.replace(/\$([a-zA-Z0-9_]+)(\[([a-zA-Z0-9_]+)\])?/g, (match, nombre, bracket, idx) => {
            if (idx !== undefined) {
                return `{{${nombre}[${idx}]}}`;
            }
            return `{{${nombre}}}`;
        });
 
        return texto;
    }
 
    static evaluarExpresion(expr) {
        if (!expr) return '';
 
        // Nodo con tipo explícito
        if (typeof expr === 'object' && expr.tipo) {
            return this.resolverValor(expr);
        }
 
        if (typeof expr === 'object' && expr.op) {
            if (expr.izq !== undefined) {
                return `${this.evaluarExpresion(expr.izq)} ${expr.op} ${this.evaluarExpresion(expr.der)}`;
            } else {
                return `${expr.op}${this.evaluarExpresion(expr.der)}`;
            }
        }
 
        if (typeof expr === 'string') {
            return this.procesarTexto(expr);
        }
 
        return String(expr);
    }
 
    static indentar(html, prefijo = '  ') {
        return html.replace(/\n/g, '\n' + prefijo);
    }
}
 
module.exports = TraductorHTML;