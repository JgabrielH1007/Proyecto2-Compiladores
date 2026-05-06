class TraductorCSS {
    constructor() {
        this.clasesGeneradas = {}; // Guarda las propiedades de cada clase para el 'extends'
    }

    /**
     * Inicia la traducción del AST de estilos.
     */
    traducir(ast) {
        if (!ast || !Array.isArray(ast)) return '';
        
        this.clasesGeneradas = {}; // Reiniciar memoria por cada traducción
        let cssFinal = '';
        
        for (const elemento of ast) {
            cssFinal += this.procesarNodo(elemento, {});
        }
        
        return cssFinal;
    }

    /**
     * Procesa clases o ciclos. Pasa un 'scope' (entorno) para saber el valor de las variables.
     */
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

    // ==========================================
    // TRADUCCIÓN DE CLASES Y PROPIEDADES
    // ==========================================

    traducirEstilo(nodo, scope) {
        // 1. Calcular el nombre real de la clase (Ej: si es "col-$i", se vuelve "col-1")
        let nombreClase = nodo.selector.id;
        if (nodo.selector.variable) {
            const valorVar = scope[nodo.selector.variable] || '';
            nombreClase += valorVar;
        }

        let lineasCSS = [];

        // 2. Manejar Herencia (EXTENDS)
        if (nodo.extends) {
            const claseBase = nodo.extends;
            if (this.clasesGeneradas[claseBase]) {
                // Copiamos todas las propiedades de la clase padre
                lineasCSS = [...this.clasesGeneradas[claseBase]];
            } else {
                lineasCSS.push(`  /* Advertencia: La clase base '${claseBase}' no existe o no se definió antes */`);
            }
        }

        // 3. Traducir las declaraciones propias
        if (nodo.declaraciones && nodo.declaraciones.length > 0) {
            for (const dec of nodo.declaraciones) {
                const propCSS = dec.propiedad.replace(/ /g, '-'); 
                const valorCSS = this.formatearValor(dec.valor, scope, dec.propiedad);
                
                // Evalúa si es la declaración especial abreviada de bordes
                if (dec.isShorthand) {
                    lineasCSS.push(`  ${propCSS}: ${valorCSS} ${dec.estilo} ${dec.color};`);
                } else {
                    lineasCSS.push(`  ${propCSS}: ${valorCSS};`);
                }
            }
        }
        // 4. Guardar en memoria por si otra clase hace 'extends' de esta en el futuro
        this.clasesGeneradas[nombreClase] = lineasCSS;

        // 5. Ensamblar la cadena final
        return `.${nombreClase} {\n${lineasCSS.join('\n')}\n}\n\n`;
    }

    formatearValor(valor, scope, propiedad) {
        // Si el valor es una expresión matemática o variable
        if (typeof valor === 'object') {
            const numEvaluado = this.evaluarExpresion(valor, scope);
            // Si la propiedad es de medida y no es un porcentaje puro, le ponemos 'px'
            if (this.esPropiedadDeMedida(propiedad)) {
                return `${numEvaluado}px`;
            }
            return numEvaluado;
        }
        
        // Si es un porcentaje ("100%") o cadena ("solid", "#FF0000", "rgb(0,0,0)")
        return valor; 
    }

    esPropiedadDeMedida(prop) {
        const p = prop.toLowerCase();
        return p.includes('width') || p.includes('height') || p.includes('padding') || 
               p.includes('margin') || p.includes('size') || p.includes('radius');
    }

    // ==========================================
    // TRADUCCIÓN DE LÓGICA (CICLOS Y MATEMÁTICA)
    // ==========================================

    traducirFor(nodo, scope) {
        let cssCiclo = '';
        
        // Evaluar límites del ciclo
        const inicio = this.evaluarExpresion(nodo.inicio, scope);
        const fin = this.evaluarExpresion(nodo.fin, scope);
        
        // Determinar condición (through = incluyente, to = excluyente)
        const limite = nodo.rango.toUpperCase() === 'THROUGH' ? fin : fin - 1;

        // Desenrollar el ciclo (crear las clases dinámicamente)
        for (let i = inicio; i <= limite; i++) {
            // Clonar el scope y actualizar el valor de la variable iteradora
            const nuevoScope = { ...scope };
            nuevoScope[nodo.variable] = i;

            // Procesar el cuerpo del for con este nuevo valor
            for (const elemento of nodo.cuerpo) {
                cssCiclo += this.procesarNodo(elemento, nuevoScope);
            }
        }

        return cssCiclo;
    }

    evaluarExpresion(expr, scope) {
        // Si es un número atómico
        if (typeof expr === 'number') return expr;
        if (!isNaN(parseFloat(expr))) return parseFloat(expr);
        
        // Si es una variable del for (ej: "$i")
        if (typeof expr === 'string' && expr.startsWith('$')) {
            return scope[expr] !== undefined ? scope[expr] : 0;
        }

        // Si es una operación (+, -, *, /, %)
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

module.exports = new TraductorCSS(); // Exportamos una instancia