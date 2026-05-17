class TraductorCSS {
    constructor() {
        this.clasesGeneradas = {};
    }

    traducir(ast) {
        if (!ast || !Array.isArray(ast)) return '';

        this.clasesGeneradas = {};
        let cssFinal = '/* CÓDIGO CSS GENERADO */\n';

        for (const elemento of ast) {
            cssFinal += this.procesarNodo(elemento, {});
        }

        return cssFinal;
    }

    procesarNodo(nodo, scope) {
        if (!nodo) return '';

        if (nodo.tipo === 'ESTILO') {
            return this.traducirEstilo(nodo, scope);
        } else if (nodo.tipo === 'FOR') {
            return this.traducirFor(nodo, scope);
        }

        return '';
    }

    traducirEstilo(nodo, scope) {
        let nombreClase = nodo.selector.id;
        if (nodo.selector.variable) {
            const valorVar = scope[nodo.selector.variable] || '';
            nombreClase += valorVar;
        }

        let lineasCSS = [];

        if (nodo.extends) {
            const claseBase = nodo.extends;
            if (this.clasesGeneradas[claseBase]) {
                lineasCSS = [...this.clasesGeneradas[claseBase]];
            } else {
                lineasCSS.push(`  /* Advertencia: La clase base '${claseBase}' no existe o no se definió antes */`);
            }
        }

        if (nodo.declaraciones && nodo.declaraciones.length > 0) {
            for (const dec of nodo.declaraciones) {
                const propCSS = this.mapearPropiedad(dec.propiedad);

                if (dec.isShorthand) {
                    const ancho  = this.evaluarExpresion(dec.valor, scope);
                    const estilo = this.mapearEstiloBorde(dec.estilo);
                    const color  = this.formatearColor(dec.color);
                    lineasCSS.push(`  ${propCSS}: ${this.redondear(ancho)}px ${estilo} ${color};`);
                } else {
                    const valorCSS = this.formatearValor(dec.valor, scope, dec.propiedad);
                    lineasCSS.push(`  ${propCSS}: ${valorCSS};`);
                }
            }
        }

        this.clasesGeneradas[nombreClase] = lineasCSS;
        return `.${nombreClase} {\n${lineasCSS.join('\n')}\n}\n\n`;
    }

    mapearPropiedad(prop) {
        const mapa = {
            'text size'            : 'font-size',
            'text font'            : 'font-family',
            'text align'           : 'text-align',
            'background color'     : 'background-color',
            'border radius'        : 'border-radius',
            'border style'         : 'border-style',
            'border width'         : 'border-width',
            'border color'         : 'border-color',
            'border top'           : 'border-top',
            'border right'         : 'border-right',
            'border bottom'        : 'border-bottom',
            'border left'          : 'border-left',
            'border top style'     : 'border-top-style',
            'border right style'   : 'border-right-style',
            'border bottom style'  : 'border-bottom-style',
            'border left style'    : 'border-left-style',
            'border top width'     : 'border-top-width',
            'border right width'   : 'border-right-width',
            'border bottom width'  : 'border-bottom-width',
            'border left width'    : 'border-left-width',
            'border top color'     : 'border-top-color',
            'border right color'   : 'border-right-color',
            'border bottom color'  : 'border-bottom-color',
            'border left color'    : 'border-left-color',
            'padding left'         : 'padding-left',
            'padding right'        : 'padding-right',
            'padding top'          : 'padding-top',
            'padding bottom'       : 'padding-bottom',
            'margin left'          : 'margin-left',
            'margin right'         : 'margin-right',
            'margin top'           : 'margin-top',
            'margin bottom'        : 'margin-bottom',
            'min-width'            : 'min-width',
            'max-width'            : 'max-width',
            'min-height'           : 'min-height',
            'max-height'           : 'max-height',
            'height'               : 'min-height',
        };
        return mapa[prop] || prop.replace(/ /g, '-');
    }

    mapearEstiloBorde(estilo) {
        const mapa = {
            'DOTTED' : 'dotted',
            'LINE'   : 'dashed',
            'DOUBLE' : 'double',
            'SOLID'  : 'solid',
            'solid'  : 'solid',
        };
        return mapa[estilo] || estilo.toLowerCase();
    }

    formatearValor(valor, scope, propiedad) {
        if (this.esPropiedadSoloEstiloBorde(propiedad)) {
            return this.mapearEstiloBorde(valor);
        }

        if (propiedad === 'text align') {
            return String(valor).toLowerCase();
        }

        if (propiedad === 'text font') {
            return this.mapearFuente(valor);
        }

        if (this.esColor(valor)) {
            return this.formatearColor(valor);
        }

        if (typeof valor === 'object' || (typeof valor === 'string' && valor.startsWith('$'))) {
            const num = this.evaluarExpresion(valor, scope);
            if (this.esPropiedadDeMedida(propiedad)) {
                return `${this.redondear(num)}px`;
            }
            return this.redondear(num);
        }

        if (typeof valor === 'number') {
            if (this.esPropiedadDeMedida(propiedad)) {
                return `${this.redondear(valor)}px`;
            }
            return this.redondear(valor);
        }

        if (typeof valor === 'string' && valor.endsWith('%')) {
            return valor;
        }

        return valor;
    }

    mapearFuente(fuente) {
        const mapa = {
            'HELVETICA'  : 'Helvetica, sans-serif',
            'SANS SERIF' : 'sans-serif',
            'SANS'       : 'Arial, sans-serif',
            'MONO'       : 'monospace',
            'CURSIVE'    : 'cursive',
        };
        return mapa[fuente] || fuente;
    }

    formatearColor(color) {
        return color;
    }

    esPropiedadDeMedida(prop) {
        const p = prop.toLowerCase();
        return (
            p.includes('width')    ||
            p.includes('height')   ||
            p.includes('padding')  ||
            p.includes('margin')   ||
            p.includes('text size') ||
            p.includes('size')     ||
            p.includes('radius')
        );
    }

    esPropiedadSoloEstiloBorde(prop) {
        const estilos = [
            'border style', 'border top style', 'border right style',
            'border bottom style', 'border left style'
        ];
        return estilos.includes(prop);
    }

    esColor(valor) {
        if (typeof valor !== 'string') return false;
        const colores = ['blue','white','red','green','violet','gray','black','lightgray'];
        return (
            colores.includes(valor) ||
            valor.startsWith('#')   ||
            valor.startsWith('rgb(')
        );
    }

    redondear(num) {
        if (typeof num !== 'number') return num;
        return Math.round(num * 100) / 100;
    }

    traducirFor(nodo, scope) {
        let cssCiclo = '';

        const inicio = this.evaluarExpresion(nodo.inicio, scope);
        const fin    = this.evaluarExpresion(nodo.fin, scope);
        const limite = nodo.rango.toUpperCase() === 'THROUGH' ? fin : fin - 1;

        for (let i = inicio; i <= limite; i++) {
            const nuevoScope = { ...scope, [nodo.variable]: i };
            for (const elemento of nodo.cuerpo) {
                cssCiclo += this.procesarNodo(elemento, nuevoScope);
            }
        }

        return cssCiclo;
    }

    evaluarExpresion(expr, scope) {
        if (typeof expr === 'number') return expr;
        if (!isNaN(parseFloat(expr)) && typeof expr !== 'object') return parseFloat(expr);

        if (typeof expr === 'string' && expr.startsWith('$')) {
            return scope[expr] !== undefined ? scope[expr] : 0;
        }

        if (expr && expr.op) {
            const izq = this.evaluarExpresion(expr.izq, scope);
            const der = this.evaluarExpresion(expr.der, scope);

            switch (expr.op) {
                case '+':      return izq + der;
                case '-':      return izq - der;
                case '*':      return izq * der;
                case '/':      return der !== 0 ? izq / der : 0;
                case '%':      return der !== 0 ? izq % der : 0;
                case 'UMINUS': return -der;
            }
        }

        return expr;
    }
}

module.exports = new TraductorCSS();