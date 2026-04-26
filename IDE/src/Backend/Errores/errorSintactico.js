class ErrorSintactico {
    constructor(linea, columna, token_encontrado, tokens_esperados) {
        this.tipo = "Sintáctico";
        this.linea = linea;
        this.columna = columna;
        this.token_encontrado = token_encontrado;
        this.esperado = tokens_esperados;
        const esperadosLimpio = tokens_esperados.map(t => t.replace(/'/g, '')).join(', ');
        this.mensaje = `Se encontró '${token_encontrado}', pero se esperaba: ${esperadosLimpio}.`;
    }
}

module.exports = ErrorSintactico;