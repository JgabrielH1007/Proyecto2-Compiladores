const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');


const Analizador = require('./Clases/analizador'); 
const TraductorSQL = require('./Clases/TraductorSQL'); 

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
    const { codigo, formato } = req.body; 

    const respuestaAnalisis = miAnalizador.analizar(codigo, formato);

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
    } else {
        // Si el formato es 'comp', 'style', o 'principal', solo devolvemos el éxito del análisis
        res.json(respuestaAnalisis);
    }
});

// Arrancar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Node corriendo en el puerto ${PORT}`);
});