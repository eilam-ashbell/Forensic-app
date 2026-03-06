import * as Comlink from 'comlink'
import * as exifr from 'exifr'
import type { MetadataEntry } from '../types/tools'

const FORENSIC_KEYS = new Set([
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'GPSDateStamp',
  'GPSTimeStamp',
  'DateTimeOriginal',
  'DateTimeDigitized',
  'DateTime',
  'Software',
  'Make',
  'Model',
  'LensModel',
  'SerialNumber',
  'CameraOwnerName',
  'ThumbnailImage',
  'UserComment',
  'ImageDescription',
  'Artist',
  'Copyright',
])

export class MetadataWorker {
  async extractMetadata(file: File): Promise<MetadataEntry[]> {
    const parsed = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      icc: true,
      makerNote: true,
      translateKeys: true,
      translateValues: true,
    })

    if (!parsed) return []

    const entries: MetadataEntry[] = []
    for (const [key, value] of Object.entries(parsed)) {
      let displayValue: string | number | boolean | null
      if (value === null || value === undefined) {
        displayValue = null
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value)
      } else {
        displayValue = value as string | number | boolean
      }

      // Determine group from key prefix heuristic
      let group = 'EXIF'
      if (key.startsWith('GPS')) group = 'GPS'
      else if (key.startsWith('xmp') || key.startsWith('Xmp')) group = 'XMP'
      else if (key.startsWith('iptc') || key.startsWith('Iptc')) group = 'IPTC'

      entries.push({
        key,
        value: displayValue,
        group,
        forensicFlag: FORENSIC_KEYS.has(key),
      })
    }

    return entries.sort((a, b) => {
      if (a.forensicFlag && !b.forensicFlag) return -1
      if (!a.forensicFlag && b.forensicFlag) return 1
      return a.group.localeCompare(b.group) || a.key.localeCompare(b.key)
    })
  }
}

Comlink.expose(new MetadataWorker())
