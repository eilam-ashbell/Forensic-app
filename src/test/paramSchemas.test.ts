import { describe, it, expect } from 'vitest'
import { PARAM_SCHEMAS } from '../constants/paramSchemas'
import { TOOL_DEFAULT_PARAMS } from '../constants/defaults'
import { TOOL_IDS } from '../types/tools'

describe('paramSchemas', () => {
  it('all schema keys reference valid tool IDs', () => {
    const schemaToolIds = Object.keys(PARAM_SCHEMAS)
    for (const id of schemaToolIds) {
      expect(TOOL_IDS).toContain(id)
    }
  })

  it('schema keys align with default param keys', () => {
    for (const [toolId, schema] of Object.entries(PARAM_SCHEMAS)) {
      const defaults = TOOL_DEFAULT_PARAMS[toolId as keyof typeof TOOL_DEFAULT_PARAMS]
      if (!defaults) continue
      for (const key of Object.keys(schema)) {
        expect(Object.keys(defaults)).toContain(key)
      }
    }
  })

  it('range fields have min < max', () => {
    for (const schema of Object.values(PARAM_SCHEMAS)) {
      for (const field of Object.values(schema)) {
        if (field.type === 'range') {
          expect(field.min).toBeLessThan(field.max)
          expect(field.step).toBeGreaterThan(0)
        }
      }
    }
  })

  it('select fields have at least 2 options', () => {
    for (const schema of Object.values(PARAM_SCHEMAS)) {
      for (const field of Object.values(schema)) {
        if (field.type === 'select') {
          expect(field.options.length).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })
})
