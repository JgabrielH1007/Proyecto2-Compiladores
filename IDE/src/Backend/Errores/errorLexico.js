class ErrorLexico {
    constructor(linea, columna, caracter) {
        this.tipo = "Léxico";
        this.linea = linea;
        this.columna = columna;
        this.caracter_encontrado = caracter;
        this.mensaje = `El carácter '${caracter}' no pertenece al lenguaje Wison.`;
    }
}

module.exports = ErrorLexico;