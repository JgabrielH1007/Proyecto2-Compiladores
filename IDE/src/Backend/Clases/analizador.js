const parserPrincipal = require('../modelo/lenguajePrincipal');
const parserComp = require('../modelo/lenguajeComp');
const parserStyle = require('../modelo/lenguajeStyle');
const parserDbase = require('../modelo/lenguajeDbase');
const valuadorSemantico = require('./valuadorSemantico');
const ErrorLexico = require('../Errores/errorLexico');
const ErrorSintactico = require('../Errores/errorSintactico');

class Analizador {
    obtenerTipoArchivo(tipo) {
        if (tipo === 'comp')   return parserComp.parser;
        if (tipo === 'styles') return parserStyle.parser;
        if (tipo === 'dbase')  return null;
        return parserPrincipal.parser;
    }

    ejecutarParser(tipo, codigo) {
        if (tipo === 'comp')   return parserComp.parse(codigo);
        if (tipo === 'styles') return parserStyle.parse(codigo);
        if (tipo === 'dbase')  return parserDbase.parse(codigo);
        return parserPrincipal.parse(codigo);
    }

    converitrHash(hash) {
        const linea   = hash.loc ? hash.loc.first_line   : 0;
        const columna = hash.loc ? hash.loc.first_column : 0;
        const texto   = hash.text || '';
        if (hash.token === 'INVALID') { //Si el token es invalid, creo un error
            return new ErrorLexico(linea, columna, texto);
        }
        return new ErrorSintactico(linea, columna, texto, hash.expected || []);
    }

    recolectarErroresRecuperados(instancia, errores, limite = 20) {
        if (!instancia || !instancia.erroresRecuperados) return;
        let agregados = 0;
        for (const err of instancia.erroresRecuperados) {
            if (agregados >= limite) break;
            const hash = err.hash;
            if (!hash || !hash.loc || !hash.loc.first_line) continue;
            const linea   = hash.loc.first_line;
            const columna = hash.loc.first_column;
            if (errores.some(e => e.linea === linea && e.columna === columna)) continue;
            // Ignorar errores en cascasda
            const esCierre = ['}', ')', ']', ';', 'EOF'].includes(hash.text);
            const hayErrorPrevio = errores.some(e => e.linea <= linea);
            if (esCierre && hayErrorPrevio) continue;
            errores.push(this.converitrHash(hash));
            agregados++;
        }
    }

    parsear(instancia, tipo, codigo) {
        if (instancia) instancia.erroresRecuperados = [];
        try { return this.ejecutarParser(tipo, codigo); }
        catch (e) { return null; }
    }

    analizar(codigo, tipo, directorioBase) {
        let respuesta = { exito: false, resultado: null, errores: [] };
        const semantico = new valuadorSemantico(directorioBase);
        console.log('Este es el directorio base recibido en el analizador:', directorioBase);

        const instancia = this.obtenerTipoArchivo(tipo);

        const resultado = this.parsear(instancia, tipo, codigo);
        this.recolectarErroresRecuperados(instancia, respuesta.errores);

        if (respuesta.errores.length === 0) {
            if (resultado) {
                if (tipo === 'comp') {
                    respuesta.errores.push(...semantico.analizar(resultado, 'comp'));
                } else if (tipo !== 'styles' && tipo !== 'dbase') {
                    respuesta.errores.push(...semantico.analizar(resultado, 'y'));
                }
            }
            if (respuesta.errores.length === 0) {
                respuesta.exito = true;
                respuesta.resultado = resultado;
            }
        }

        return respuesta;
    }
}
module.exports = Analizador;
