class TraductorCSS {
    constructor() {
        this.clasesGeneradas = {}; 
    }

    traducir(ast) {
        if (!ast || !Array.isArray(ast)) return '';
        
        this.clasesGeneradas = {};
        let cssFinal = '';
        
        for (const elemento of ast) {
            cssFinal += this.procesarNodo(elemento, {});
        }
        
        return cssFinal;
    }

    procesarNodo(nodo, scope) {
        if (!nodo) return '';

        if (nodo.tipo === 'ESTILO') {
            return this.traducirEstilo(nodo, scope);
        } 
        else if (nodo.tipo === 'FOR') {
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
                const propCSS = dec.propiedad.replace(/ /g, '-'); 
                const valorCSS = this.formatearValor(dec.valor, scope, dec.propiedad);
                
                if (dec.isShorthand) {
                    lineasCSS.push(`  ${propCSS}: ${valorCSS} ${dec.estilo} ${dec.color};`);
                } else {
                    lineasCSS.push(`  ${propCSS}: ${valorCSS};`);
                }
            }
        }
        this.clasesGeneradas[nombreClase] = lineasCSS;

        return `.${nombreClase} {\n${lineasCSS.join('\n')}\n}\n\n`;
    }

    formatearValor(valor, scope, propiedad) {
        if (typeof valor === 'object' || (typeof valor === 'string' && valor.startsWith('$'))) {
            const numEvaluado = this.evaluarExpresion(valor, scope);
            
            if (this.esPropiedadDeMedida(propiedad) || propiedad.includes('border')) {
                return `${numEvaluado}px`;
            }
            return numEvaluado;
        }
        
        return valor; 
    }

    esPropiedadDeMedida(prop) {
        const p = prop.toLowerCase();
        return p.includes('width') || p.includes('height') || p.includes('padding') || 
               p.includes('margin') || p.includes('size') || p.includes('radius');
    }

    traducirFor(nodo, scope) {
        let cssCiclo = '';
        
        const inicio = this.evaluarExpresion(nodo.inicio, scope);
        const fin = this.evaluarExpresion(nodo.fin, scope);
        
        const limite = nodo.rango.toUpperCase() === 'THROUGH' ? fin : fin - 1;

        for (let i = inicio; i <= limite; i++) {
            const nuevoScope = { ...scope };
            nuevoScope[nodo.variable] = i;

            for (const elemento of nodo.cuerpo) {
                cssCiclo += this.procesarNodo(elemento, nuevoScope);
            }
        }

        return cssCiclo;
    }

    evaluarExpresion(expr, scope) {
        if (typeof expr === 'number') return expr;
        if (!isNaN(parseFloat(expr))) return parseFloat(expr);
        
        if (typeof expr === 'string' && expr.startsWith('$')) {
            return scope[expr] !== undefined ? scope[expr] : 0;
        }

        if (expr && expr.op) {
            const izq = this.evaluarExpresion(expr.izq, scope);
            const der = this.evaluarExpresion(expr.der, scope);
            
            switch (expr.op) {
                case '+': return izq + der;
                case '-': return izq - der;
                case '*': return izq * der;
                case '/': return der !== 0 ? izq / der : 0;
                case '%': return der !== 0 ? izq % der : 0;
                case 'UMINUS': return -der;
            }
        }
        
        return expr;
    }
}

module.exports = new TraductorCSS();