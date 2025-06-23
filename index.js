const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PUERTO = process.env.PORT || 3000;

// Función para descargar el archivo MP3 temporalmente
async function descargarArchivo(url, destino) {
  const writer = fs.createWriteStream(destino);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// Función para subir el archivo a tmpfiles.org
async function subirArchivoTmpFiles(rutaArchivo) {
  const form = new FormData();
  form.append('file', fs.createReadStream(rutaArchivo));
  const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
    headers: form.getHeaders()
  });
  // El enlace de descarga está en response.data.data.url
  return response.data.data.url;
}

app.get('/cancion', async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({ error: 'Falta el parámetro q (nombre de la canción o artista)' });
  }
  try {
    // Paso 1: Obtiene los datos de la API interna
    const respuesta = await axios.get('https://api.neoxr.eu/api/play', {
      params: { q, apikey: 'Paimon' }
    });
    const data = respuesta.data;

    // Paso 2: Descarga el archivo MP3 temporalmente
    const nombreTemp = `cancion_${Date.now()}.mp3`;
    const rutaTemp = path.join(__dirname, nombreTemp);
    await descargarArchivo(data.data.url, rutaTemp);

    // Paso 3: Sube el archivo a tmpfiles.org y obtiene el nuevo enlace
    const enlaceTemporal = await subirArchivoTmpFiles(rutaTemp);

    // Borra el archivo temporal
    fs.unlink(rutaTemp, () => {});

    // Paso 4: Devuelve la respuesta en español con el nuevo enlace
    const respuestaFinal = {
      creador: "newton",
      estado: data.status,
      identificador: data.id,
      titulo: data.title,
      miniatura: data.thumbnail,
      duracion: data.duration,
      duracion_formato: data.fduration,
      canal: data.channel,
      vistas: data.views,
      publicado: data.publish,
      datos: {
        nombre_archivo: data.data.filename,
        calidad: data.data.quality,
        tamaño: data.data.size,
        extension: data.data.extension,
        enlace: enlaceTemporal // El nuevo enlace temporal del audio
      }
    };

    res.json(respuestaFinal);

  } catch (error) {
    res.status(500).json({
      error: 'Ocurrió un error al obtener o procesar los datos',
      detalles: error.message
    });
  }
});

app.listen(PUERTO, () => {
  console.log(`API en funcionamiento en el puerto ${PUERTO}`);
});
