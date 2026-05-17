'use strict';

class TraductorHTML {

    static traducir(ast) {
        if (!ast || !Array.isArray(ast)) return '';
        let htmlFinal = '';
        for (const componente of ast) {
            htmlFinal += this.procesarNodo(componente, []) + '\n\n';
        }
        return htmlFinal;
    }

    static procesarNodo(nodo, clasesPadre = []) {
        if (!nodo) return '';
        if (Array.isArray(nodo)) {
            if (nodo.length > 0 && nodo[0] && nodo[0].tipo === 'CELDA') {
                return this.traducirFila(nodo, clasesPadre);
            }
            return nodo.map(n => this.procesarNodo(n, clasesPadre)).join('\n');
        }
        switch (nodo.tipo) {
            case 'COMPONENTE_DEF': return this.traducirComponente(nodo, clasesPadre);
            case 'SECTION':       return this.traducirSeccion(nodo, clasesPadre);
            case 'TABLA':         return this.traducirTabla(nodo, clasesPadre);
            case 'CELDA':         return this.procesarNodo(nodo.contenido, clasesPadre);
            case 'TEXTO':         return this.traducirTexto(nodo, clasesPadre);
            case 'IMG':           return this.traducirImg(nodo, clasesPadre);
            case 'FORM':          return this.traducirForm(nodo, clasesPadre);
            case 'INPUT_TEXT':
            case 'INPUT_NUMBER':
            case 'INPUT_BOOL':    return this.traducirInput(nodo, clasesPadre);
            case 'IF':            return this.traducirIf(nodo, clasesPadre);
            case 'FOR_EACH':
            case 'FOR_TRACK':     return this.traducirFor(nodo, clasesPadre);
            case 'SWITCH':        return this.traducirSwitch(nodo, clasesPadre);
            case 'INVOKE':        return this.traducirInvocacion(nodo, clasesPadre);
            default: return '';
        }
    }

    static traducirComponente(nodo, clasesPadre) {
        const bodyHtml = this.procesarNodo(nodo.body, clasesPadre);
        let paramsAttr = '';
        if (nodo.params && Array.isArray(nodo.params)) {
            const paramNames = nodo.params.map(p => p.id ? p.id : p).join(',');
            paramsAttr = ` data-params="${paramNames}"`;
        }
        return `<template id="${nodo.id}"${paramsAttr}>\n  ${this.indentar(bodyHtml)}\n</template>`;
    }

    static traducirSeccion(nodo, clasesPadre) {
        let estilosPropios   = nodo.estilos || [];
        let estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        let nuevoHistorial   = [...clasesPadre, ...estilosFiltrados];
        const clasesHTML     = this.obtenerClases(estilosFiltrados, 'yfera-flex-col');
        const bodyHtml       = this.procesarNodo(nodo.contenido, nuevoHistorial);
        return `<section${clasesHTML}>\n  ${this.indentar(bodyHtml)}\n</section>`;
    }

    static traducirForm(nodo, clasesPadre) {
        let estilosPropios   = nodo.estilos || [];
        let estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        let nuevoHistorial   = [...clasesPadre, ...estilosFiltrados];
        const clases         = this.obtenerClases(estilosFiltrados, 'yfera-flex-col');
        const bodyHtml       = this.procesarNodo(nodo.body, nuevoHistorial);

        let submitHtml = '';
        if (nodo.submit) {
            const btnClases = this.obtenerClases(nodo.submit.estilos);
            let labelBtn = 'Enviar';
            let onClick  = '';
            if (nodo.submit.props && Array.isArray(nodo.submit.props)) {
                const propLabel = nodo.submit.props.find(p => p.tipo === 'LABEL');
                const propFn    = nodo.submit.props.find(p => p.tipo === 'FUNCTION');
                if (propLabel) labelBtn = this.procesarTexto(propLabel.val.replace(/(^"|"$)/g, ''));
                if (propFn) {
                    const fnNombre = this.resolverValor(propFn.fn);
                    const args = propFn.refs.map(r => `document.getElementById('${r.replace('@','')}').value`).join(', ');
                    onClick = ` onclick="${fnNombre}(${args})"`;
                }
            }
            submitHtml = `\n  <button type="submit"${btnClases}${onClick}>${labelBtn}</button>`;
        }
        return `<form${clases}>\n  ${this.indentar(bodyHtml)}${submitHtml}\n</form>`;
    }

    static traducirTexto(nodo, clasesPadre) {
        let estilosPropios   = nodo.estilos || [];
        let estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const clasesHTML     = this.obtenerClases(estilosFiltrados);
        let valorLimpio = String(nodo.val).replace(/^"|"$/g, '').trim();
        valorLimpio = valorLimpio
            .split('\n').map(l => l.trim()).filter(l => l !== '').join('<br>');
        const textoFinal = this.procesarTexto(valorLimpio);
        return `<p${clasesHTML}>${textoFinal}</p>`;
    }

    static traducirImg(nodo, clasesPadre) {
        let estilosPropios   = nodo.estilos || [];
        let estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const clasesHTML     = this.obtenerClases(estilosFiltrados);
        if (nodo.vals.length === 1) {
            const src = this.resolverValor(nodo.vals[0]);
            return `<img src="${src}"${clasesHTML} alt="Imagen" />`;
        }
        let html = `<div class="carousel${estilosFiltrados.length ? ' '+estilosFiltrados.join(' ') : ''}">\n`;
        nodo.vals.forEach(val => { html += `  <img src="${this.resolverValor(val)}" alt="Imagen" />\n`; });
        html += `</div>`;
        return html;
    }

    static obtenerClases(arrayEstilos, claseAdicional = '') {
        let lista = arrayEstilos ? [...arrayEstilos] : [];
        if (claseAdicional) lista.push(claseAdicional);
        if (lista.length === 0) return '';
        return ` class="${lista.join(' ')}"`;
    }

    static traducirTabla(nodo, clasesPadre) {
        const clases = this.obtenerClases(nodo.estilos);
        let html = `<table${clases}>\n  <tbody>\n`;
        nodo.filas.forEach(item => {
            const itemHtml = this.procesarNodo(item, clasesPadre);
            if (itemHtml.trim() !== '') html += `    ${this.indentar(itemHtml, '    ')}\n`;
        });
        html += `  </tbody>\n</table>`;
        return html;
    }

    static traducirFila(filaArr, clasesPadre) {
        let html = `<tr>\n`;
        filaArr.forEach(col => {
            const celdaHtml = this.procesarNodo(col.contenido, clasesPadre);
            html += `  <td>\n    ${this.indentar(celdaHtml, '    ')}\n  </td>\n`;
        });
        html += `</tr>`;
        return html;
    }

    static traducirInput(nodo, clasesPadre) {
        let estilosPropios   = nodo.estilos || [];
        let estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const clases         = this.obtenerClases(estilosFiltrados);
        let type = 'text';
        if (nodo.tipo === 'INPUT_NUMBER') type = 'number';
        if (nodo.tipo === 'INPUT_BOOL')   type = 'checkbox';
        let idAttr = '', valueAttr = '', labelHtml = '';
        if (nodo.props && Array.isArray(nodo.props)) {
            nodo.props.forEach(prop => {
                if (prop.tipo === 'id') {
                    const idVal = this.resolverValor(prop.val);
                    idAttr = ` id="${idVal}" name="${idVal}"`;
                }
                if (prop.tipo === 'value') {
                    const v = this.resolverValor(prop.val);
                    valueAttr = type === 'checkbox' ? (v === 'true' ? ' checked' : '') : ` value="${v}"`;
                }
                if (prop.tipo === 'label') {
                    labelHtml = `<label>${this.procesarTexto(this.resolverValor(prop.val))}</label>\n`;
                }
            });
            if (idAttr && labelHtml) {
                const idMatch = idAttr.match(/id="([^"]+)"/);
                if (idMatch) labelHtml = labelHtml.replace('<label>', `<label for="${idMatch[1]}">`);
            }
        }
        return `${labelHtml}<input type="${type}"${idAttr}${clases}${valueAttr} />`;
    }

    static traducirIf(nodo, clasesPadre) {
        const condLimpia = this.evaluarExpresionPlana(nodo.cond);
        const bodyHtml   = this.procesarNodo(nodo.body, clasesPadre);
        let html = `<template data-if="${condLimpia}">\n  ${this.indentar(bodyHtml)}\n</template>`;
        if (nodo.elseifs && nodo.elseifs.length > 0) {
            nodo.elseifs.forEach(eif => {
                const condElif = this.evaluarExpresionPlana(eif.cond);
                html += `\n<template data-elseif="${condElif}">\n  ${this.indentar(this.procesarNodo(eif.body, clasesPadre))}\n</template>`;
            });
        }
        if (nodo.sino) {
            html += `\n<template data-else>\n  ${this.indentar(this.procesarNodo(nodo.sino, clasesPadre))}\n</template>`;
        }
        return html;
    }

    static traducirFor(nodo, clasesPadre) {
        const bodyHtml = this.procesarNodo(nodo.body, clasesPadre);
        let estructura = '';

        if (nodo.tipo === 'FOR_EACH') {
            const col  = (nodo.coleccion || '').replace(/^\$/, '');
            const iter = (nodo.iterador  || '').replace(/^\$/, '');
            estructura = `data-foreach="${col}:${iter}"`;
        } else {
            const varsStr = nodo.vars.map(v => {
                const col  = (v.col  || '').replace(/^\$/, '');
                const iter = (v.iter || '').replace(/^\$/, '');
                return `${col}:${iter}`;
            }).join(', ');
            const track = (nodo.track || '$index').replace(/^\$/, '');
            estructura = `data-fortrack="${varsStr}" data-track="${track}"`;
        }

        let html = `<template ${estructura}>\n  ${this.indentar(bodyHtml)}\n</template>`;
        if (nodo.empty) {
            html += `\n<template data-forempty>\n  ${this.indentar(this.procesarNodo(nodo.empty, clasesPadre))}\n</template>`;
        }
        return html;
    }

    static traducirSwitch(nodo, clasesPadre) {
        const expr = this.evaluarExpresionPlana(nodo.expr);
        let html = `<div data-switch="${expr}">\n`;
        nodo.cases.forEach(c => {
            const valCase = this.resolverValorPlano(c.val);
            html += `  <template data-case="${valCase}">\n    ${this.indentar(this.procesarNodo(c.body, clasesPadre), '    ')}\n  </template>\n`;
        });
        if (nodo.def) {
            html += `  <template data-default>\n    ${this.indentar(this.procesarNodo(nodo.def, clasesPadre), '    ')}\n  </template>\n`;
        }
        return html + `</div>`;
    }

    static traducirInvocacion(nodo, clasesPadre) {
        const argsStr = nodo.args.map(a => this.resolverValor(a)).join(', ');
        return `<div data-component="${nodo.id}" data-args="${argsStr}"></div>`;
    }

    // resolver val con llaves
    static resolverValor(val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object' && val.tipo) {
            switch (val.tipo) {
                case 'VAR':         return `{{${val.val.replace(/^\$/, '')}}}`;
                case 'STR':         return this.procesarTexto(val.val.replace(/(^"|"$)/g, ''));
                case 'NUM':         return String(val.val);
                case 'BOOL':        return String(val.val);
                case 'ARR_NUM_IDX': return `{{${val.id.replace(/^\$/, '')}[${val.idx}]}}`;
                case 'ARR_VAR_IDX': return `{{${val.id.replace(/^\$/, '')}[${val.idx.replace(/^\$/, '')}]}}`;
            }
        }
        if (typeof val === 'string') return this.procesarTexto(val.replace(/(^"|"$)/g, ''));
        if (typeof val === 'boolean' || typeof val === 'number') return String(val);
        return '';
    }

    // resolver val plano 
    static resolverValorPlano(val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object' && val.tipo) {
            switch (val.tipo) {
                case 'VAR':         return val.val.replace(/^\$/, '');
                case 'STR':         return val.val.replace(/(^"|"$)/g, '');
                case 'NUM':         return String(val.val);
                case 'BOOL':        return String(val.val);
                case 'ARR_NUM_IDX': return `${val.id.replace(/^\$/, '')}[${val.idx}]`;
                case 'ARR_VAR_IDX': return `${val.id.replace(/^\$/, '')}[${val.idx.replace(/^\$/, '')}]`;
            }
        }
        if (typeof val === 'string') return val.replace(/(^"|"$)/g, '');
        if (typeof val === 'boolean' || typeof val === 'number') return String(val);
        return '';
    }

    static procesarTexto(texto) {
        if (typeof texto !== 'string') return String(texto ?? '');
        texto = texto.replace(/`([^`]+)`/g, (_, expr) => {
            const exprLimpia = expr.replace(/\$([a-zA-Z0-9_]+)/g, '$1').trim();
            return `{{${exprLimpia}}}`;
        });
        texto = texto.replace(/\$([a-zA-Z0-9_]+)\[([a-zA-Z0-9_]+)\]/g, '{{$1[$2]}}');
        texto = texto.replace(/\$([a-zA-Z0-9_]+)/g, '{{$1}}');
        return texto;
    }

    // evaluar ex con llave
    static evaluarExpresion(expr) {
        if (!expr) return '';
        if (typeof expr === 'object' && expr.tipo) return this.resolverValor(expr);
        if (typeof expr === 'object' && expr.op) {
            if (expr.izq !== undefined)
                return `${this.evaluarExpresion(expr.izq)} ${expr.op} ${this.evaluarExpresion(expr.der)}`;
            return `${expr.op}${this.evaluarExpresion(expr.der)}`;
        }
        if (typeof expr === 'string') return this.procesarTexto(expr);
        return String(expr);
    }

    // evaluar ex plana
    static evaluarExpresionPlana(expr) {
        if (!expr) return '';
        if (typeof expr === 'object' && expr.tipo) return this.resolverValorPlano(expr);
        if (typeof expr === 'object' && expr.op) {
            if (expr.izq !== undefined)
                return `${this.evaluarExpresionPlana(expr.izq)} ${expr.op} ${this.evaluarExpresionPlana(expr.der)}`;
            return `${expr.op}${this.evaluarExpresionPlana(expr.der)}`;
        }
        if (typeof expr === 'string') return expr.replace(/^\$/, '');
        return String(expr);
    }

    static indentar(html, prefijo = '  ') {
        return html.replace(/\n/g, '\n' + prefijo);
    }
}

module.exports = TraductorHTML;