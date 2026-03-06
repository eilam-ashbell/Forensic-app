import { bench, describe } from 'vitest'
import { md5Hex } from '../lib/image/md5'
import { makeTiny64Png } from '../../test/fixtures/generate'

describe('md5Hex performance', () => {
  const buf1kb = new ArrayBuffer(1024)
  const buf1mb = new ArrayBuffer(1024 * 1024)

  bench('MD5 of 1 KB', () => {
    md5Hex(buf1kb)
  })

  bench('MD5 of 1 MB', () => {
    md5Hex(buf1mb)
  })
})

describe('PNG fixture generation', () => {
  bench('makeTiny64Png (64×64)', () => {
    makeTiny64Png()
  })
})
