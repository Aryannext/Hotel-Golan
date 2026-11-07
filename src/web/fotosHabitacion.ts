// Fotografías de demostración: únicamente en este navegador, sin backend.
const CLAVE_PREFIJO = 'hotel_golan_foto_hab_';
export const FOTO_DEFECTO = '/habitacion-demo.jpg';
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;
export function validarArchivoFoto(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Elige JPG, PNG o WebP. Si tu teléfono usa HEIC, conviértela a JPG.';
  if (!file.size) return 'La imagen está vacía.';
  if (file.size > MAX_BYTES_FOTO) return 'La imagen supera 5 MB. Reduce su tamaño e intenta de nuevo.';
  return null;
}
export function obtenerFotoHabitacion(numero: string): string {
  try { return localStorage.getItem(CLAVE_PREFIJO + numero) || FOTO_DEFECTO; }
  catch { return FOTO_DEFECTO; }
}
function avisar(numero: string, dataUrl: string) { window.dispatchEvent(new CustomEvent('foto-habitacion-actualizada', { detail: { numero, dataUrl } })); }
export function guardarFotoHabitacion(numero: string, dataUrl: string): void {
  try { localStorage.setItem(CLAVE_PREFIJO + numero, dataUrl); }
  catch { throw new Error('No se pudo guardar: el almacenamiento local está lleno o bloqueado. Elimina otra foto y vuelve a intentar.'); }
  avisar(numero, dataUrl);
}
export function eliminarFotoHabitacion(numero: string): void {
  try { localStorage.removeItem(CLAVE_PREFIJO + numero); }
  catch { throw new Error('El navegador no permite eliminar la fotografía guardada.'); }
  avisar(numero, FOTO_DEFECTO);
}
export function procesarArchivoFoto(file: File, maxAncho = 1200, calidad = 0.82): Promise<string> {
  const error = validarArchivoFoto(file);
  if (error) return Promise.reject(new Error(error));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo. Selecciona otra imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no contiene una imagen válida. Selecciona otra foto.'));
      img.onload = () => {
        if (!img.width || !img.height || img.width * img.height > 20000000) { reject(new Error('La fotografía supera 20 megapíxeles o no tiene dimensiones válidas. Reduce su tamaño.')); return; }
        try {
          const canvas = document.createElement('canvas'), ratio = Math.min(1, maxAncho / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('El navegador no puede preparar la imagen.');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', calidad));
        } catch (e) { reject(e); }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
