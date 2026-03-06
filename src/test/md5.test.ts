import { describe, it, expect } from 'vitest'
import { md5Hex } from '../lib/image/md5'

function str2buf(s: string): ArrayBuffer {
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

describe('md5Hex', () => {
  // RFC 1321 test vectors
  it('empty string', () => {
    expect(md5Hex(str2buf(''))).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  it('"a"', () => {
    expect(md5Hex(str2buf('a'))).toBe('0cc175b9c0f1b6a831c399e269772661')
  })

  it('"abc"', () => {
    expect(md5Hex(str2buf('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('"message digest"', () => {
    expect(md5Hex(str2buf('message digest'))).toBe('f96b697d7cb7938d525a2f31aaf161d0')
  })

  it('26 lower-case letters', () => {
    expect(md5Hex(str2buf('abcdefghijklmnopqrstuvwxyz'))).toBe(
      'c3fcd3d76192e4007dfb496cca67e13b',
    )
  })

  it('produces 32-char hex string', () => {
    const hash = md5Hex(str2buf('test'))
    expect(hash).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('different inputs produce different hashes', () => {
    expect(md5Hex(str2buf('hello'))).not.toBe(md5Hex(str2buf('world')))
  })
})
