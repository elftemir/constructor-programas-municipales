# Preparar el Programa Marco oficial desde dos DOCX

Esta herramienta trabaja con archivos indicados expresamente. No lee la base de datos, no modifica documentos de entrada, no instala contenidos y no publica nada.

1. En el código fuente, ejecuta `npm ci`.
2. Prepara un DOCX castellano y otro catalán: un área por **Título 1** y una medida por **viñeta** de primer nivel. Ambos deben tener las mismas áreas en el mismo orden y el mismo número de medidas en cada área. El título y el texto pueden estar traducidos. No uses tablas, viñetas anidadas ni listas numeradas. Un texto inicial antes del primer área no se convierte en medida; dentro de un área todo párrafo debe ser una medida con viñeta.
3. Guarda una copia del `catalog.json` completo del repositorio de contenidos. Pásala con `--catalog-base` para conservar los demás paquetes. Si empiezas un repositorio vacío, omite esa opción.
4. Ejecuta, con tus rutas de entrada y una carpeta de salida vacía:

```powershell
node scripts/empaquetar_programa_marco.js --es documentos/marco-es.docx --ca documentos/marco-ca.docx --out salida-oficial --id programa-marco-2027-2031 --version 1.0.0 --title-es "Programa Marco 2027–2031" --title-ca "Programa Marc 2027–2031" --catalog-base documentos/catalog.json --catalog-version 1.0.1
```

Si difieren las áreas o sus medidas, el proceso para e indica el área y los recuentos de cada idioma. No escribe un paquete parcial. Si la carpeta de salida contiene archivos, para para evitar sobrescribirlos.

La carpeta de salida contiene el ZIP oficial, SHA256.txt y catalog.json completo. El ZIP contiene manifest.json y los PDF/JSON ES/CA, con los hashes internos y `official: true`, sin marca de prueba. Los PDF son documentos de lectura generados a partir del contenido estructurado; **no conservan la maquetación original del DOCX**. Revisa ambos PDF y el texto de los JSON. Los títulos de las medidas se obtienen de su primera frase y su texto íntegro se conserva.

Los identificadores canónicos se forman por posición de área y viñeta. En futuras versiones conserva el orden y la identidad de las medidas existentes. Para una reorganización que cambie esas posiciones hace falta planificar la correspondencia de identificadores; no publiques una actualización que reutilice un identificador para otra medida.

El script comprueba el ZIP con el mismo verificador estricto de la aplicación. El hash comprueba integridad respecto al catálogo, no acredita por sí solo quién redactó o aprobó el contenido. Revisa el catálogo antes de subirlo y conserva los documentos fuente fuera del código publicable.

Publicación manual: repositorio **constructor-programas-municipales-content** → release con la etiqueta `release_tag` del catálogo → adjuntar el ZIP → publicar estable → reemplazar el catalog.json completo de main. Comprueba que `download_url` descarga exactamente ese ZIP. Nunca subas el provisional de prueba. No copies DOCX, PDF, paquetes ni textos privados a `1_codigo-fuente` o al instalador.
