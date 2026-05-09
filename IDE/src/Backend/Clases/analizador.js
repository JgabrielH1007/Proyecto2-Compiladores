const parserPrincipal = require('../modelo/lenguajePrincipal');
const parserComp = require('../modelo/lenguajeComp');
const parserStyle = require('../modelo/lenguajeStyle');
const parserDbase = require('../modelo/lenguajeDbase');
const ErrorLexico = require('../Errores/errorLexico');
const ErrorSintactico = require('../Errores/errorSintactico');

class Analizador{
    analizar(codigo, tipo) {
        let respuesta = {
            exito: false,
            resultado: null,
            errores: []
        };

        let resultado = null;

        try{
            if(tipo === 'comp') {
                resultado = parserComp.parse(codigo);
            } else if(tipo === 'styles') {
                resultado = parserStyle.parse(codigo);
            } else if(tipo === 'dbase') {
                resultado = parserDbase.parse(codigo);
            }else {
                resultado = parserPrincipal.parse(codigo);
            }
            respuesta.exito = true;
            respuesta.resultado = resultado;
        }catch(error){
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