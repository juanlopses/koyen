const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PUERTO = process.env.PORT || 3000;

// Descargar archivo temporalmente
async function descargarArchivo(url, destino) {
  const writer = fs.createWriteStream(destino);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// Subir archivo a tmpfiles.org
async function subirArchivoTmpFiles(rutaArchivo) {
  const form = new FormData();
  form.append('file', fs.createReadStream(rutaArchivo));
  const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
    headers: form.getHeaders()
  });
  // El enlace de descarga está en response.data.data.url
  if (response.data && response.data.data && response.data.data.url) {
    return response.data.data.url;
  } else {
    throw new Error('No se pudo obtener el enlace temporal del archivo.');
  }
}

app.get('/cancion', async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({ error: 'Falta el parámetro q (nombre de la canción o artista)' });
  }
  try {
    // Consulta a la API de neoxr
    const respuesta = await axios.get('https://api.neoxr.eu/api/play', {
      params: { q, apikey: 'Paimon' }
    });
    const data = respuesta.data;

    // Validación de estructura
    if (!data || !data.data || !data.data.url) {
      return res.status(404).json({
        error: 'No se encontró la canción o la API interna no devolvió datos válidos.',
        detalles: data
      });
    }

    // Descarga el archivo temporalmente
    const nombreTemp = `cancion_${Date.now()}.mp3`;
    const rutaTemp = path.join(__dirname, nombreTemp);
    await descargarArchivo(data.data.url, rutaTemp);

    // Sube el archivo y obtiene el nuevo enlace
    const enlaceTemporal = await subirArchivoTmpFiles(rutaTemp);
    // Elimina el archivo temporal
    fs.unlink(rutaTemp, () => {});

    // Respuesta en español con el nuevo enlace
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
        enlace: enlaceTemporal // Enlace temporal del audio
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
