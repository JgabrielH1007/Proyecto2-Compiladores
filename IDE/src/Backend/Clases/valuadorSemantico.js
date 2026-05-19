const fs = require('fs');
const path = require('path');
const { Simbolo, TablaSimbolos } = require('./tablaSimbolos');

class valuadorSemantico {
    constructor(archivosDisponibles = []) {
        this.errores = [];
        this.archivosDisponibles = archivosDisponibles; 
        this.entornoGlobal = new TablaSimbolos();
    }

    analizar(ast, tipoArchivo) {
        this.errores = [];

        if (tipoArchivo === 'comp') {
            this.validarComponentes(ast);
        } else if (tipoArchivo === 'y') {
            this.validarLenguajePrincipal(ast);
        }

        return this.errores;
    }
    validarComponentes(astComp) {
        const componentes = Array.isArray(astComp) ? astComp : (astComp.componentes || []); 
        
        componentes.forEach(comp => {
            const nuevoSimbolo = new Simbolo(comp.id, 'componente', 'componente', comp.linea, comp.columna);
            
            const agregado = this.entornoGlobal.agregar(nuevoSimbolo);
            
            if (!agregado) {
                this.agregarError(
                    `El componente '${comp.id}' ya ha sido declarado. Los nombres de componentes no se pueden repetir.`, 
                    comp.linea, 
                    comp.columna
                );
            }
        });
    }

    validarImport(nodoImp) {
        let ruta = nodoImp.ruta.replace(/["']/g, '').trim();

        if (!ruta.startsWith('./') && !ruta.startsWith('../')) {
            this.agregarError(`El import '${ruta}' debe ser una ruta relativa (debe iniciar con ./ o ../).`, nodoImp.linea, nodoImp.columna);
            return;
        }

        const nombreArchivo = ruta.split('/').pop();

        const archivoExiste = this.archivosDisponibles.some(rutaProyecto => 
            rutaProyecto.endsWith('/' + nombreArchivo) || rutaProyecto === nombreArchivo
        );

        if (!archivoExiste) {
            this.agregarError(`El archivo '${ruta}' no se encuentra en el proyecto. Asegúrate de que la ruta sea correcta y el archivo exista.`, nodoImp.linea, nodoImp.columna);
        }
    }

    validarLenguajePrincipal(ast) {
        if (!ast || ast.tipo !== 'PROGRAMA') return;

        if (ast.imports) {
            ast.imports.forEach(imp => this.validarImport(imp));
        }

        if (ast.globales) {
            ast.globales.forEach(nodo => this.procesarNodoMain(nodo, this.entornoGlobal));
        }
        
        if (ast.funciones) {
            ast.funciones.forEach(func => {
                const entornoLocal = new TablaSimbolos(this.entornoGlobal);
                func.body.forEach(inst => this.procesarNodoMain(inst, entornoLocal));
            });
        }
        
        if (ast.main) {
            const entornoMain = new TablaSimbolos(this.entornoGlobal);
            ast.main.forEach(inst => this.procesarNodoMain(inst, entornoMain));
        }
    }


    procesarNodoMain(nodo, entorno) {
        if (!nodo) return;

        if (nodo.tipo === 'EXECUTE') {
            this.validarConexionDB(nodo);
        } else if (nodo.tipo === 'DECLARACION_ARR_DB') {
            entorno.agregar(new Simbolo(nodo.id, nodo.tipoDato, 'arreglo_db', nodo.linea, nodo.columna));
            this.validarConexionDB(nodo);
        } 
        
    }

    validarConexionDB(nodo) {
        const queryStr = nodo.query ? nodo.query.replace(/`/g, '').trim() : '';
        
        if (queryStr === '') {
            this.agregarError(`La consulta execute a la base de datos no puede estar vacía.`, nodo.linea, nodo.columna);
            return;
        }

        if (!queryStr.includes('TABLE') && !queryStr.includes('DELETE') && !queryStr.includes('[')) {
            if (!queryStr.includes('.')) {
                 this.agregarError(`La consulta '${queryStr}' no parece seguir el formato válido para SQLite de YFERA.`, nodo.linea, nodo.columna);
            }
        }
    }

    agregarError(mensaje, linea = 0, columna = 0) {
        this.errores.push({ tipo: 'Semántico', mensaje, linea, columna });
    }
}

module.exports = valuadorSemantico;