const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');


const Analizador = require('./Clases/analizador'); 
const TraductorSQL = require('./Clases/TraductorSQL'); 
const TraductorHTML = require('./Clases/TraductorHTML');
const traductorCSS = require('./Clases/TraductorCSS');
const TraductorJS = require('./Clases/TraductorJS');
const Conexion = require('./Clases/conexion');
const parserPrincipal = require('./modelo/lenguajePrincipal');

const app = express();
app.use(cors());
app.use(express.json());

const dbFolder = path.resolve(__dirname, '../DataBases');
const dbPath = path.join(dbFolder, 'proyecto.db');

if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
    console.log('Carpeta DataBases creada automáticamente.');
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error crítico al abrir DB:', err.message);
    } else {
        console.log('Conectado exitosamente a SQLite en:', dbPath);
    }
});

const miAnalizador = new Analizador();

app.post('/api/enviarCodigo', (req, res) => {
    const { codigo, formato, archivos } = req.body; 

    const respuestaAnalisis = miAnalizador.analizar(codigo, formato, archivos);
    console.log(`Análisis terminado: exito=${respuestaAnalisis.exito}, errores=${respuestaAnalisis.errores.length}`);

    if (!respuestaAnalisis.exito) {
        return res.json(respuestaAnalisis);
    }

    if (formato === 'dbase') {
        try {
            const sentenciasSQL = TraductorSQL.traducir(respuestaAnalisis.resultado);
            
            if (sentenciasSQL.length === 0) {
                 return res.json({ exito: true, resultado: "Script vacío, nada que ejecutar." });
            }

           const sqlFinal = sentenciasSQL.join('\n');

           if (sqlFinal.trim().toUpperCase().startsWith('SELECT')) {
               
               db.all(sqlFinal, [], (err, rows) => {
                   if (err) {
                       return res.json({ 
                           exito: false, 
                           errores: [{ tipo: "Error SQLite", mensaje: err.message, linea: 0, columna: 0 }] 
                       });
                   }

                   if (rows.length === 0) {
                       return res.json({ 
                           exito: true, 
                           resultado: `SQL Generado:\n${sqlFinal}\n\nNo se encontraron registros en la tabla.` 
                       });
                   }

                   const datos = JSON.stringify(rows, null, 2);
                   res.json({ 
                       exito: true, 
                       resultado: `SQL Generado:\n${sqlFinal}\n\nDatos Recuperados:\n${datos}` 
                   });
               });

           } else {
               
               db.exec(sqlFinal, function(err) {
                   if (err) {
                       return res.json({ 
                           exito: false, 
                           errores: [{ tipo: "Error SQLite", mensaje: err.message, linea: 0, columna: 0 }] 
                       });
                   }
                   
                   res.json({ 
                       exito: true, 
                       resultado: `Comando traducido y ejecutado en la Base de Datos.\nSQL Generado:\n${sqlFinal}` 
                   });
               });
            }
        } catch (error) {
            res.json({ 
                exito: false, 
                errores: [{ 
                    tipo: "Error de Traducción", 
                    mensaje: error.message,
                    linea: 0, columna: 0 
                }] 
            });
        } 
    } else if (formato === 'comp') {
        try {
            const codigoHTML = TraductorHTML.traducir(respuestaAnalisis.resultado);
            
            if (!codigoHTML) {
                 return res.json({ exito: true, resultado: "Script vacío, sin componentes generados." });
            }

            res.json({ 
                exito: true, 
                resultado: `<!-- CÓDIGO GENERADO -->\n\n${codigoHTML}` 
            });

        } catch (error) {
            res.json({ 
                exito: false, 
                errores: [{ 
                    tipo: "Error de Traducción HTML", 
                    mensaje: error.message,
                    linea: 0, columna: 0 
                }] 
            });
        }
    } else if (formato === 'styles') {
        try {
            const codigoCSS = traductorCSS.traducir(respuestaAnalisis.resultado);
            
            if (!codigoCSS) {
                 return res.json({ exito: true, resultado: "Hoja de estilos vacía." });
            }

            res.json({ 
                exito: true, 
                resultado: `${codigoCSS}` 
            });

        } catch (error) {
            res.json({ 
                exito: false, 
                errores: [{ tipo: "Error de Compilación CSS", mensaje: error.message, linea: 0, columna: 0 }] 
            });
        }
    } else if (formato === 'principal' || formato === 'y') {
        
        try {
            // El analizador validó el código .y y construyó el AST
            const codigoJS = TraductorJS.traducir(respuestaAnalisis.resultado);
            
            if (!codigoJS) {
                 return res.json({ exito: true, resultado: "Script principal vacío." });
            }

            res.json({ 
                exito: true, 
                resultado: `/* CÓDIGO JS GENERADO */\n\n${codigoJS}` 
            });

        } catch (error) {
            res.json({ 
                exito: false, 
                errores: [{ 
                    tipo: "Error de Compilación JavaScript", 
                    mensaje: error.message, 
                    linea: 0, columna: 0 
                }] 
            });
        }
    } else {
        res.json(respuestaAnalisis);
    }
});

app.post('/api/ensamblar', (req, res) => {
    const { css, htmlComponentes, jsTraducido, codigoY } = req.body;

    try {
        let astUsuario = null;
        
        if (codigoY && codigoY.trim() !== '') {
            astUsuario = parserPrincipal.parse(codigoY);
        }

        const documentoFinal = Conexion.ensamblarHTML({
            css: css,
            htmlComponentes: htmlComponentes,
            jsTraducido: jsTraducido
        }, {

            ast: astUsuario 
        });

        res.json({ exito: true, htmlFinal: documentoFinal });
    } catch (error) {
        console.error("Error al ensamblar:", error);
        res.json({ exito: false, mensaje: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Node corriendo en el puerto ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\nERROR: El puerto ${PORT} ya está en uso.`);
        console.error(`Ejecuta: kill $(lsof -ti:${PORT}) para liberarlo.\n`);
    } else {
        console.error('Error al iniciar el servidor:', err.message);
    }
    process.exit(1);
});
