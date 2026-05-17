class Simbolo {
    constructor(id, tipo, tipoVariable, linea, columna) {
        this.id = id;
        this.tipo = tipo; 
        this.tipoVariable = tipoVariable; 
        this.linea = linea || 0;
        this.columna = columna || 0;
    }
}

class TablaSimbolos {
    constructor(padre = null) {
        this.padre = padre; 
        this.simbolos = new Map(); 
    }

    agregar(simbolo) {
        if (this.simbolos.has(simbolo.id)) {
            return false; 
        }
        this.simbolos.set(simbolo.id, simbolo);
        return true;
    }

    obtener(id) {
        let actual = this;
        while (actual != null) {
            if (actual.simbolos.has(id)) {
                return actual.simbolos.get(id);
            }
            actual = actual.padre;
        }
        return null; 
    }
}

module.exports = { Simbolo, TablaSimbolos };