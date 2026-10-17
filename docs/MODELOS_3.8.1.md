# Modelos locales

La elección por defecto sigue siendo Qwen 2.5 1.5B por su menor memoria y mayor velocidad. Qwen3 4B da mejores resultados de catalán en la comparación, pero la prueba en una RTX 3060 no equivale a certificar todos los equipos de 8 GB.

El modelo original [Qwen3 4B Instruct 2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) tiene licencia Apache-2.0 y no usa modo de pensamiento. Se utiliza el [GGUF de Unsloth](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF), revisión a06e946bb6b655725eafa393f4a9745d460374c9, SHA-256 3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597. La descarga valida el hash antes de aceptar el archivo. Los binarios CPU y Vulkan son los originales b11476, verificados por sus manifiestos.

Un modelo retirado se conserva en disco hasta que el usuario pulse Borrar el modelo retirado y confirme. Nunca se puede volver a activar. El aviso de retirada se muestra una vez y su confirmación se guarda independientemente del aviso de generación por sesión.
