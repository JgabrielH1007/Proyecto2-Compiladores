'use strict';

class TraductorHTML {

    static traducir(ast) {
        if (!ast || !Array.isArray(ast)) return '';
        let htmlFinal = '';
        for (const componente of ast) {
            htmlFinal += this.procesarNodo(componente, [], false) + '\n\n';
        }
        return htmlFinal;
    }

    static procesarNodo(nodo, clasesPadre = [], dentroTabla = false) {
        if (!nodo) return '';
        if (Array.isArray(nodo)) {
            if (nodo.length > 0 && nodo[0] && nodo[0].tipo === 'CELDA') {
                return this.traducirFila(nodo, clasesPadre);
            }
            return nodo.map(n => this.procesarNodo(n, clasesPadre, dentroTabla)).join('\n');
        }
        switch (nodo.tipo) {
            case 'COMPONENTE_DEF': return this.traducirComponente(nodo, clasesPadre);
            case 'SECTION':       return this.traducirSeccion(nodo, clasesPadre, dentroTabla);
            case 'TABLA':         return this.traducirTabla(nodo, clasesPadre);
            case 'CELDA':         return this.procesarNodo(nodo.contenido, clasesPadre, true);
            case 'TEXTO':         return this.traducirTexto(nodo, clasesPadre);
            case 'IMG':           return this.traducirImg(nodo, clasesPadre);
            case 'FORM':          return this.traducirForm(nodo, clasesPadre);
            case 'INPUT_TEXT':
            case 'INPUT_NUMBER':
            case 'INPUT_BOOL':    return this.traducirInput(nodo, clasesPadre);
            case 'IF':            return this.traducirIf(nodo, clasesPadre, dentroTabla);
            case 'FOR_EACH':
            case 'FOR_TRACK':     return this.traducirFor(nodo, clasesPadre, dentroTabla);
            case 'SWITCH':        return this.traducirSwitch(nodo, clasesPadre, dentroTabla);
            case 'INVOKE':        return this.traducirInvocacion(nodo, clasesPadre);
            default: return '';
        }
    }

    static traducirComponente(nodo, clasesPadre) {
        const bodyHtml = this.procesarNodo(nodo.body, clasesPadre, false);
        let paramsAttr = '';
        if (nodo.params && Array.isArray(nodo.params)) {
            const paramNames = nodo.params.map(p => p.id ? p.id : p).join(',');
            paramsAttr = ` data-params="${paramNames}"`;
        }
        return `<template id="${nodo.id}"${paramsAttr}>\n  ${this.indentar(bodyHtml)}\n</template>`;
    }

    static traducirSeccion(nodo, clasesPadre, dentroTabla = false) {
        const estilosPropios   = nodo.estilos || [];
        const estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const nuevoHistorial   = [...clasesPadre, ...estilosFiltrados];
        const claseLayout      = dentroTabla ? '' : 'yfera-flex-col';
        const clasesHTML       = this.obtenerClases(estilosFiltrados, claseLayout);
        const bodyHtml         = this.procesarNodo(nodo.contenido, nuevoHistorial, dentroTabla);
        return `<section${clasesHTML}>\n  ${this.indentar(bodyHtml)}\n</section>`;
    }

    static traducirForm(nodo, clasesPadre) {
        const estilosPropios   = nodo.estilos || [];
        const estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const nuevoHistorial   = [...clasesPadre, ...estilosFiltrados];
        const clases           = this.obtenerClases(estilosFiltrados, 'yfera-flex-col');
        const bodyHtml         = this.procesarNodo(nodo.body, nuevoHistorial, false);

        let submitHtml = '';
        if (nodo.submit) {
            const btnClases = this.obtenerClases(nodo.submit.estilos || []);
            let labelBtn = 'Enviar';
            let onClick  = '';
            if (nodo.submit.props && Array.isArray(nodo.submit.props)) {
                const propLabel = nodo.submit.props.find(p => p.tipo === 'LABEL');
                const propFn    = nodo.submit.props.find(p => p.tipo === 'FUNCTION');
                if (propLabel) labelBtn = this.procesarTexto(propLabel.val.replace(/(^"|"$)/g, ''));
                if (propFn) {
                    let fnNombre;
                    if (propFn.fn && typeof propFn.fn === 'object' && propFn.fn.tipo === 'VAR') {
                        fnNombre = propFn.fn.val.replace(/^\$/, '');
                    } else if (typeof propFn.fn === 'string') {
                        fnNombre = propFn.fn.replace(/^\$/, '').replace(/^\$/, '');
                    } else {
                        fnNombre = this.resolverValorPlano(propFn.fn);
                    }
                    const args = propFn.refs.map(r =>
                        `document.getElementById('${r.replace('@', '')}').value`
                    ).join(', ');
                    onClick = ` onclick="${fnNombre}(${args})"`;
                }
            }
            submitHtml = `\n  <button type="button"${btnClases}${onClick}>${labelBtn}</button>`;
        }
        return `<form${clases}>\n  ${this.indentar(bodyHtml)}${submitHtml}\n</form>`;
    }

    static traducirTexto(nodo, clasesPadre) {
        const estilosPropios   = nodo.estilos || [];
        const estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const clasesHTML       = this.obtenerClases(estilosFiltrados);
        let valorLimpio = String(nodo.val).replace(/^"|"$/g, '').trim();
        valorLimpio = valorLimpio
            .split('\n').map(l => l.trim()).filter(l => l !== '').join('<br>');
        const textoFinal = this.procesarTexto(valorLimpio);
        return `<p${clasesHTML}>${textoFinal}</p>`;
    }

    static traducirImg(nodo, clasesPadre) {
        const estilosPropios   = nodo.estilos || [];
        const estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const clasesHTML       = this.obtenerClases(estilosFiltrados);
        if (nodo.vals.length === 1) {
            const src = this.resolverValor(nodo.vals[0]);
            return `<img data-src="${src}"${clasesHTML} alt="Imagen" />`;
        }
        const claseCarrusel = `carousel${estilosFiltrados.length ? ' ' + estilosFiltrados.join(' ') : ''}`;
        let html = `<div class="${claseCarrusel}">\n`;
        nodo.vals.forEach(val => {
            html += `  <img data-src="${this.resolverValor(val)}" alt="Imagen" />\n`;
        });
        html += `</div>`;
        return html;
    }

    static obtenerClases(arrayEstilos, claseAdicional = '') {
        const lista = arrayEstilos ? [...arrayEstilos] : [];
        if (claseAdicional) lista.push(claseAdicional);
        if (lista.length === 0) return '';
        return ` class="${lista.join(' ')}"`;
    }

    static traducirTabla(nodo, clasesPadre) {
        const clases = this.obtenerClases(nodo.estilos || []);
        let html = `<table${clases}>\n  <tbody>\n`;
        nodo.filas.forEach(item => {
            const itemHtml = this.procesarNodo(item, clasesPadre, true);
            if (itemHtml.trim() !== '') html += `    ${this.indentar(itemHtml, '    ')}\n`;
        });
        html += `  </tbody>\n</table>`;
        return html;
    }

    static traducirFila(filaArr, clasesPadre) {
        let html = `<tr>\n`;
        filaArr.forEach(col => {
            const celdaHtml = this.procesarNodo(col.contenido, clasesPadre, true);
            html += `  <td>\n    ${this.indentar(celdaHtml, '    ')}\n  </td>\n`;
        });
        html += `</tr>`;
        return html;
    }

    static traducirInput(nodo, clasesPadre) {
        const estilosPropios   = nodo.estilos || [];
        const estilosFiltrados = estilosPropios.filter(c => !clasesPadre.includes(c));
        const clases           = this.obtenerClases(estilosFiltrados);
        let type = 'text';
        if (nodo.tipo === 'INPUT_NUMBER') type = 'number';
        if (nodo.tipo === 'INPUT_BOOL')   type = 'checkbox';
        let idAttr = '', valueAttr = '', labelHtml = '';
        if (nodo.props && Array.isArray(nodo.props)) {
            nodo.props.forEach(prop => {
                if (prop.tipo === 'id') {
                    const idVal = this.resolverValorPlano(prop.val);
                    idAttr = ` id="${idVal}" name="${idVal}"`;
                }
                if (prop.tipo === 'value') {
                    const v = this.resolverValor(prop.val);
                    valueAttr = type === 'checkbox' ? (v === 'true' ? ' checked' : '') : ` value="${v}"`;
                }
                if (prop.tipo === 'label') {
                    labelHtml = `<label>${this.procesarTexto(this.resolverValorPlano(prop.val))}</label>\n`;
                }
            });
            if (idAttr && labelHtml) {
                const idMatch = idAttr.match(/id="([^"]+)"/);
                if (idMatch) labelHtml = labelHtml.replace('<label>', `<label for="${idMatch[1]}">`);
            }
        }
        return `${labelHtml}<input type="${type}"${idAttr}${clases}${valueAttr} />`;
    }

    static traducirIf(nodo, clasesPadre, dentroTabla = false) {
        const condLimpia = this.evaluarExpresionPlana(nodo.cond);
        const bodyHtml   = this.procesarNodo(nodo.body, clasesPadre, dentroTabla);
        let html = `<template data-if="${condLimpia}">\n  ${this.indentar(bodyHtml)}\n</template>`;
        if (nodo.elseifs && nodo.elseifs.length > 0) {
            nodo.elseifs.forEach(eif => {
                const condElif = this.evaluarExpresionPlana(eif.cond);
                const eifHtml  = this.procesarNodo(eif.body, clasesPadre, dentroTabla);
                html += `\n<template data-elseif="${condElif}">\n  ${this.indentar(eifHtml)}\n</template>`;
            });
        }
        if (nodo.sino) {
            const sinoHtml = this.procesarNodo(nodo.sino, clasesPadre, dentroTabla);
            html += `\n<template data-else>\n  ${this.indentar(sinoHtml)}\n</template>`;
        }
        return html;
    }

    static traducirFor(nodo, clasesPadre, dentroTabla = false) {
        const bodyHtml = this.procesarNodo(nodo.body, clasesPadre, dentroTabla);
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
            const emptyHtml = this.procesarNodo(nodo.empty, clasesPadre, dentroTabla);
            html += `\n<template data-forempty>\n  ${this.indentar(emptyHtml)}\n</template>`;
        }
        return html;
    }

    static traducirSwitch(nodo, clasesPadre, dentroTabla = false) {
        const expr = this.evaluarExpresionPlana(nodo.expr);
        let html = `<div data-switch="${expr}">\n`;
        nodo.cases.forEach(c => {
            const valCase  = this.resolverValorPlano(c.val);
            const caseHtml = this.procesarNodo(c.body, clasesPadre, dentroTabla);
            html += `  <template data-case="${valCase}">\n    ${this.indentar(caseHtml, '    ')}\n  </template>\n`;
        });
        if (nodo.def) {
            const defHtml = this.procesarNodo(nodo.def, clasesPadre, dentroTabla);
            html += `  <template data-default>\n    ${this.indentar(defHtml, '    ')}\n  </template>\n`;
        }
        return html + `</div>`;
    }

    static traducirInvocacion(nodo, clasesPadre) {
        const argsStr = nodo.args.map(a => this.resolverValor(a)).join(', ');
        return `<div data-component="${nodo.id}" data-args="${argsStr}"></div>`;
    }

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
        if (typeof val === 'string') return val.replace(/(^"|"$)/g, '').replace(/^\$/, '');
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