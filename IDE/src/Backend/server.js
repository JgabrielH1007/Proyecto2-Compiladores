const express = require('express');
const cors = require('cors');
// Ajusta la ruta si tu analizador.js está en otra carpeta
const Analizador = require('./Clases/analizador'); 

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Permite peticiones desde Angular
app.use(express.json()); // Permite recibir JSON en el body

// Endpoint que Angular va a consumir
app.post('/api/analizar', (req, res) => {
    // Recibimos el código y el tipo desde Angular
    const { codigo, tipo } = req.body;
    console.log(`[BACKEND] Petición recibida. Formato detectado: ${tipo}`);

    if (!codigo) {
        return res.status(400).json({ error: "No se envió código para analizar" });
    }

    try {
        const analizador = new Analizador();
        // Llamamos a tu función analizar
        const resultado = analizador.analizar(codigo, tipo || 'y'); 
        
        // Devolvemos la respuesta de tu clase al frontend
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});