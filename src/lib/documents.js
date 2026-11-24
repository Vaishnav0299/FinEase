export const documentTypes = ['Insurance', 'Vehicle', 'Medical', 'ID', 'Lease', 'Warranty', 'Tax', 'Other']
export const fileAccept = 'application/pdf,image/jpeg,image/png,image/webp'

export async function checkedFile(file) {
  if (!file || typeof file.slice !== 'function' || !file.size || file.size > 8 * 1024 * 1024) {
    throw new Error('Choose a PDF, JPEG, PNG or WebP file of up to 8 MB.')
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const header = String.fromCharCode(...bytes)
  let mime
  if (header.startsWith('%PDF-')) mime = 'application/pdf'
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg'
  else if (header.startsWith('\x89PNG\r\n\x1a\n')) mime = 'image/png'
  else if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') mime = 'image/webp'
  if (!mime) throw new Error('This file format is unsupported. Choose a PDF, JPEG, PNG or WebP file.')
  return new File([file], file.name, { type: mime })
}
