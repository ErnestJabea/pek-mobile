import fs from 'node:fs'
import path from 'node:path'
import { translations } from '../src/locales/translations.js'

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const full = path.join(dir, file)
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') walk(full, fileList)
    } else if (file.endsWith('.vue') || file.endsWith('.js')) {
      fileList.push(full)
    }
  }
  return fileList
}

const files = walk('./src')
const keyRegex = /(?:languageStore\.t|appContentStore\.t|appContentStore\.getTitle|appContentStore\.getBanner|\bt)\(\s*['"]([^'"]+)['"]/g
const foundKeys = new Set()

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  let match
  while ((match = keyRegex.exec(content)) !== null) {
    if (/^[a-zA-Z0-9_-]+$/.test(match[1])) {
      foundKeys.add(match[1])
    }
  }
}

const missingFr = []
const missingEn = []
for (const key of foundKeys) {
  if (translations.fr[key] === undefined) missingFr.push(key)
  if (translations.en[key] === undefined) missingEn.push(key)
}

const frKeys = Object.keys(translations.fr)
const enKeys = Object.keys(translations.en)
const frMissingInEn = frKeys.filter(k => !(k in translations.en))
const enMissingInFr = enKeys.filter(k => !(k in translations.fr))

console.log('--- Codebase Keys Used ---')
console.log('Total translation keys used:', foundKeys.size)
console.log('Missing in FR:', missingFr)
console.log('Missing in EN:', missingEn)

console.log('\n--- Catalog Symmetry ---')
console.log('FR total keys:', frKeys.length)
console.log('EN total keys:', enKeys.length)
console.log('Keys in FR missing in EN:', frMissingInEn)
console.log('Keys in EN missing in FR:', enMissingInFr)
