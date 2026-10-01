import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const files = [['tesseract.js/dist/worker.min.js', 'worker.min.js']]
for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  for (const extension of ['wasm.js', 'wasm']) {
    files.push([`tesseract.js-core/tesseract-core-${variant}.${extension}`, `core/tesseract-core-${variant}.${extension}`])
  }
}
for (const language of ['fra', 'eng']) {
  files.push([`@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`, `lang/${language}.traineddata.gz`])
}
for (const [source, destination] of files) {
  const target = resolve(root, 'public/ocr', destination)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(resolve(root, 'node_modules', source), target)
}
console.log(`${files.length} OCR assets prepared from locked local dependencies.`)
