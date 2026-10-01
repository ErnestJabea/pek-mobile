import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

let workerOptions
mock.module('@vladmandic/face-api', {
  namedExports: { nets: {
    tinyFaceDetector: { loadFromUri: async () => { throw new Error('Model unavailable') } },
    faceLandmark68TinyNet: { loadFromUri: async () => {} },
    faceRecognitionNet: { loadFromUri: async () => {} },
  } },
})
mock.module('tesseract.js', {
  namedExports: { createWorker: async (_languages, _mode, options) => {
    workerOptions = options
    throw new Error('OCR unavailable')
  } },
})
const { compareFaces, verifyIDDocumentOCR } = await import('../src/services/kycVerification.js')

test('missing face models request manual review without inventing a match', async (t) => {
  t.mock.method(console, 'error', () => {})
  const result = await compareFaces('fixture-id', 'fixture-selfie')
  assert.equal(result.success, false)
  assert.equal(result.isFallback, true)
  assert.equal(result.score, 0)
  assert.equal(result.distance, null)
})

test('OCR failure is not reported as verified and assets come from PEK', async (t) => {
  t.mock.method(console, 'error', () => {})
  const result = await verifyIDDocumentOCR('fixture-id')
  assert.equal(result.success, false)
  assert.equal(result.isFallback, true)
  assert.equal(result.ocrConfidence, 0)
  assert.equal(workerOptions.workerPath, '/ocr/worker.min.js')
  assert.equal(workerOptions.corePath, '/ocr/core')
  assert.equal(workerOptions.langPath, '/ocr/lang')
})

test('missing documents cannot be treated as a manual fallback success', async () => {
  const face = await compareFaces(null, null)
  const ocr = await verifyIDDocumentOCR(null)
  assert.equal(face.success, false)
  assert.equal(ocr.success, false)
  assert.notEqual(face.isFallback, true)
  assert.notEqual(ocr.isFallback, true)
})
