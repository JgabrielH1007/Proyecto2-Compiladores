const parserPrincipal = require('../modelo/lenguajePrincipal');
const parserComp = require('../modelo/lenguajeComp');
const parserStyle = require('../modelo/lenguajeStyle');
const parserDbase = require('../modelo/lenguajeDbase');
const valuadorSemantico = require('./valuadorSemantico');
const ErrorLexico = require('../Errores/errorLexico');
const ErrorSintactico = require('../Errores/errorSintactico');

class Analizador{
    analizar(codigo, tipo, directorioBase){
        let respuesta = {
            exito: false,
            resultado: null,
            errores: []
        };

        let resultado = null;
        const semantico = new valuadorSemantico(directorioBase);

        try {
            if(tipo === 'comp') {
                resultado = parserComp.parse(codigo);
                const erroresSemanticos = semantico.analizar(resultado, 'comp');
                if(erroresSemanticos.length > 0) {
                    respuesta.errores.push(...erroresSemanticos);
                }
            } else if(tipo === 'styles') {
                resultado = parserStyle.parse(codigo);
            } else if(tipo === 'dbase') {
                resultado = parserDbase.parse(codigo);
            } else {
                resultado = parserPrincipal.parse(codigo);
                const erroresSemanticos = semantico.analizar(resultado, 'y');
                if(erroresSemanticos.length > 0) {
                    respuesta.errores.push(...erroresSemanticos);
                }
            }
            
            // --- CORRECCIÓN DE LA LÓGICA ---
            // Solo es un éxito si el arreglo de errores sigue vacío
            if (respuesta.errores.length === 0) {
                respuesta.exito = true;
                respuesta.resultado = resultado;
            } else {
                // Si hay errores (semánticos), nos aseguramos de que exito sea false
                respuesta.exito = false;
                respuesta.resultado = null;
            }

        } catch(error) {
            if(error.hash){
                const linea = error.hash.loc.first_line;
                const columna = error.hash.loc.first_column;
                const texto = error.hash.text;
                const token = error.hash.token;
                const esperados = error.hash.expected;

                if(token === 'INVALID'){
                    respuesta.errores.push(new ErrorLexico(linea, columna, texto));
                } else{
                    respuesta.errores.push(new ErrorSintactico(linea, columna, texto, esperados));
                }
            }else {
                respuesta.errores.push({tipo: "Error desconocido", mensaje: error.message});
            }
        }
        return respuesta;
    }
}
module.exports = Analizador;