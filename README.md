# Image Forensics Workbench (IFW)

A fully browser-based, offline-capable forensic image analysis tool for security researchers and digital forensic analysts. All computation runs locally — no data ever leaves your machine.

Built with React + TypeScript + Vite. Heavy analysis runs in Web Workers so the UI stays responsive during long operations.

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The dev server includes hot-reload and the COOP/COEP headers required for SharedArrayBuffer support.

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server that sets the required security headers (see [Deployment](#deployment)).

### Preview the production build

```bash
npm run preview
```

Serves `dist/` on [http://localhost:4173](http://localhost:4173) with the correct headers pre-configured.

---

## Running Tests

### Unit tests (Vitest)

```bash
npm test
```

Runs the Vitest suite in watch mode. For a single-pass run:

```bash
npx vitest run
```

### Coverage report

```bash
npm run test:coverage
```

HTML report is written to `coverage/`.

### Performance benchmarks

```bash
npx vitest bench
```

Runs benchmarks in `src/test/benchmarks.bench.ts` (MD5 hashing, PNG fixture generation).

### End-to-end tests (Playwright)

Requires the production build to be served first:

```bash
npm run build
npx playwright test
```

E2E tests live in `e2e/smoke.spec.ts` and run against `http://localhost:4173`.

Install Playwright browsers if needed:

```bash
npx playwright install chromium
```

---

## Loading an Image

Drag and drop any image onto the canvas, or click **Open** in the top bar.

**Supported formats:** JPEG, PNG, WebP, TIFF, BMP, GIF, HEIC/HEIF

**Limits:** Images larger than 50 megapixels are automatically downsampled before analysis to protect memory.

After loading, the top bar shows the image dimensions, megapixel count, and file size. SHA-256 and MD5 hashes are computed at load time and included in every export for chain-of-custody documentation.

---

## Analysis Tools

Tools are grouped in the left sidebar by category. Click a tool to select it, configure its parameters in the right panel, then click **Run** (or press `R`). Results appear in the **Results drawer** at the bottom and — where applicable — as an overlay on the canvas.

### File & Metadata

| Tool | Description |
|---|---|
| **Metadata Viewer** | Extracts all EXIF, GPS, IPTC, XMP, and makernote fields. Flags forensically interesting keys (GPS coordinates, software edits, timestamps, serial numbers) in amber. |
| **File Structure Inspector** | Maps the raw binary structure of the file — JPEG markers (SOI, APP0–APPn, DQT, SOF, SOS, EOI), PNG chunks (IHDR, IDAT, tEXt, iTXt, zTXt), and their sizes. Useful for detecting truncation, appended data, or non-standard markers. |

### Compression Analysis

| Tool | Description | JPEG only |
|---|---|---|
| **JPEG Quantization Tables** | Extracts DQT markers and estimates the JPEG quality factor using the IJG formula. Multiple differing quality estimates can indicate double-compression — a common artefact of re-saved composites. | Yes |
| **Block Artifact Visualizer** | Applies Sobel gradient detection along 8-pixel boundaries and highlights DCT block edges. High edge strength at regular 8-pixel intervals indicates aggressive or repeated JPEG compression. | Yes |

### Error Level Analysis (ELA)

| Tool | Description |
|---|---|
| **ELA** | Re-encodes the image at a chosen JPEG quality, then computes the absolute difference between the original and re-encoded version. Regions at a different compression level than the background appear brighter. Configure **quality** (40–99%) and **amplify** (1–30x). |
| **Multi-Quality ELA** | Runs ELA simultaneously at five configurable quality levels (default: 70, 75, 80, 85, 90) and produces individual overlays plus a composite. Reduces false positives that appear only at a single quality level. |

### Noise Analysis

| Tool | Description |
|---|---|
| **Noise Map Visualizer** | Applies Gaussian blur then subtracts from the original to isolate the noise residual. Spliced regions often exhibit a discontinuous noise texture due to different sensors or processing pipelines. |
| **PRNU Analysis** | Photo Response Non-Uniformity: extracts the sensor fingerprint by denoising then subtracting. Computes the spatial autocorrelation of the residual across 32 lags. Compositing breaks the camera's characteristic PRNU pattern. Note: requires a reference camera fingerprint for definitive identification — this tool assesses internal consistency only. |

### Frequency Domain

| Tool | Description |
|---|---|
| **FFT Spectrum Analyzer** | Computes the 2D Fourier transform via row-column decomposition and displays the log-magnitude spectrum with DC shifted to the centre. Periodic resampling artefacts from resizing or rotation appear as regular peaks. Supports Hann, Hamming, and rectangular window functions and three colormaps (Hot, Viridis, Grayscale). |
| **DCT Coefficient Viewer** | Applies 8x8 block DCT-II to a selected colour channel (Y, Cb, or Cr) and visualises the chosen coefficient as a heatmap. Double-compression leaves a characteristic second-quantisation signature in the coefficient distribution. |

### Clone & Copy-Move Detection

| Tool | Description |
|---|---|
| **Keypoint Clone Detector** | Detects Harris corners, extracts normalised 16x16 patch descriptors, and matches them using Normalised Cross-Correlation with Lowe's ratio test. Matched keypoint clusters indicate copy-moved regions. Configure max keypoints (200–5000), ratio threshold (0.50–0.95), and minimum cluster size. |
| **Block-Matching Clone Detector** | Divides the image into fixed-size blocks and computes SSD (Sum of Squared Differences) between every block pair. Pairs below the similarity threshold are marked as potential clones. Input is capped at 512x512 to keep run time manageable. Best for textured areas where keypoints are sparse. |

### Color & Lighting

| Tool | Description |
|---|---|
| **Channel Separator** | Splits the image into individual channels across four colour spaces: RGB (red, green, blue), HSV (hue, saturation, value), CIE-LAB (L*, a*, b*), YCbCr (luma, blue difference, red difference). |
| **Lighting Direction Estimator** | Computes Sobel gradients and estimates the dominant light source direction using weighted circular mean of gradient orientations. Draws an arrow overlay indicating the estimated angle and reports confidence. Inconsistent lighting directions across image regions can indicate compositing. |
| **Histogram Analyzer** | Displays the pixel value distribution across R, G, and B channels as an interactive area chart (256 bins). Combed histograms (regular gaps) suggest levels adjustment or colour correction. Toggle log scale in the parameters panel. |

### Steganography

| Tool | Description |
|---|---|
| **LSB Plane Visualizer** | Extracts a single bit plane from a chosen channel (R, G, B, or Alpha) and scales it to 0/255 for visibility. The LSB plane of an unmodified image should appear as visual noise; structured patterns indicate LSB steganography. Reports a randomness score (0–100%). |
| **Statistical Stego Tests** | Runs three statistical steganography detection algorithms: Chi-Square test (detects equal-frequency pairs), RS Analysis (measures Regular-to-Singular group ratios under LSB flipping), and Sample Pairs Analysis (counts adjacent pairs with matching lower bits). Each test reports a p-value and estimated payload size. |

### AI Detection

| Tool | Description |
|---|---|
| **AI Forgery Detector** | Divides the image into overlapping patches and computes a local variance heatmap. Regions with anomalous variance relative to their surroundings are flagged. Reports a global suspicion score (0–100%) and confidence level. **Note:** v1 uses a heuristic approach — no ONNX model is loaded. Treat results as indicative, not definitive. |

### Raw Inspection

| Tool | Description |
|---|---|
| **Hex / Binary Viewer** | Displays raw file bytes as a hex dump (16 bytes per row). Configure the starting byte offset and number of bytes to display (1 KB – 16 KB). Useful for inspecting embedded data, verifying file signatures, or finding appended payloads. |
| **String Extractor** | Scans raw bytes for sequences of printable characters meeting a minimum length threshold (default: 6). Useful for finding embedded URLs, software version strings, camera model names, or GPS data in non-EXIF fields. |

---

## Canvas Annotations

When an image is loaded, an annotation toolbar appears above the canvas.

| Tool | Shortcut | How to use |
|---|---|---|
| Select | `V` | Click and drag annotations to move or resize them. |
| Rectangle | — | Drag to draw a rectangle outline. |
| Freehand | `D` | Click and drag to draw freely. |
| Text | `T` | Double-click anywhere to place an editable text label. |
| Color | — | Click the color swatch to choose the annotation colour. |
| Stroke width | — | Click 1, 2, 4, or 8 to choose stroke width in pixels. |
| Undo | `Ctrl+Z` | Undo the last annotation action (up to 50 steps). |
| Clear | — | Remove all annotations from the canvas. |

### Canvas overlay

When a tool completes and produces an overlay image (ELA, noise map, FFT spectrum, clone detection, etc.), it is composited on top of the base image. Use the **Overlay ON/OFF** button in the bottom-right of the canvas, or press `O` to toggle it.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `R` | Run the currently selected tool |
| `Escape` | Cancel a running tool |
| `O` | Toggle the tool overlay on/off |
| `V` | Switch to annotation Select mode |
| `D` | Switch to annotation Freehand draw |
| `T` | Switch to annotation Text placement |
| `Ctrl+Z` | Undo last annotation |
| Scroll wheel | Zoom canvas in/out |

---

## Export

Click **Export** in the top bar (visible after loading an image) to open the export dialog.

### ZIP Bundle

Downloads a `.zip` archive with the following structure:

```
original.jpg / original.png     <- source file
manifest.json                   <- session metadata + image hashes
overlays/
  ela__overlay.png
  fft-spectrum__spectrum.png
  prnu__residual.png
  prnu__correlation.png
  ...                           <- one PNG per overlay
data/
  ela.json
  fft-spectrum.json
  metadata-viewer.json
  ...                           <- full result JSON per tool
```

`manifest.json` includes the session name, timestamp, image dimensions, file name, SHA-256 hash, MD5 hash, and completed tool list with execution times.

### PDF Report

Downloads an A4 PDF containing:

- **Cover page** — session name, file metadata, SHA-256 fingerprint, completed tool count
- **One section per completed tool** — overlay images + key summary statistics

---

## Session Name

Type a name in the text field in the top bar. It is used as the export file name and is included in `manifest.json`.

---

## Deployment

The app requires two HTTP response headers to enable SharedArrayBuffer (used for WASM threads):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The dev and preview servers set these automatically. Configure them in your production web server:

**nginx:**
```nginx
add_header Cross-Origin-Opener-Policy   "same-origin";
add_header Cross-Origin-Embedder-Policy "require-corp";
```

**Vercel (`vercel.json`):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy",  "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

---

## Project Structure

```
src/
├── components/
│   ├── canvas/          # ImageCanvas (Fabric.js), AnnotationToolbar
│   ├── export/          # ExportDialog
│   ├── layout/          # TopBar, LeftSidebar, RightSidebar
│   ├── results/         # ResultsDrawer + per-tool renderers
│   ├── shared/          # ErrorBoundary, FileDropzone, ProgressBar, StatusBadge
│   └── tools/           # ToolList, ParamsPanel
├── constants/
│   ├── defaults.ts      # Default parameter values per tool
│   ├── paramSchemas.ts  # UI control descriptors for each tool's parameters
│   └── tools.ts         # Tool registry (id, label, category, description)
├── hooks/
│   ├── useImageLoader.ts       # File -> ImageRecord pipeline
│   ├── useKeyboardShortcuts.ts # Global keyboard shortcuts
│   └── useToolRunner.ts        # Engine dispatch, 120s timeout, JPEG-only guard
├── lib/
│   ├── export/          # pdf.ts (jsPDF report builder), zip.ts (JSZip bundle)
│   └── image/           # loader.ts, md5.ts (RFC 1321), sampler.ts
├── store/               # Zustand root + 4 slices (image, tool, canvas, session)
├── tools/               # One directory per tool, each with engine.ts
├── types/               # tools.ts (ToolId + ToolResult discriminated union)
└── workers/             # Web Workers: analysis, advanced, binary, clone, ela, fft, metadata
```

---

## Technical Notes

| Topic | Detail |
|---|---|
| **Offline-first** | No network requests at runtime; all analysis is local |
| **Web Workers** | Every engine runs off the main thread via Comlink; the UI never blocks |
| **ImageData transfer** | Pixel buffers are cloned before worker transfer so the original store is never neutered |
| **In-worker PNG encoding** | Workers encode overlay images using a minimal uncompressed DEFLATE implementation (no canvas.toDataURL in worker scope) |
| **MD5** | Pure-TypeScript RFC 1321 implementation for chain-of-custody display only — not for cryptographic use |
| **No persistence** | All state is ephemeral; closing the tab clears everything |
| **Dev heap monitor** | In development mode, the JS heap size is logged to the console after each tool completes |

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome / Edge 105+ | Full |
| Firefox 110+ | Full |
| Safari 16.4+ | Full (requires OffscreenCanvas) |
| Mobile browsers | Not recommended (canvas interaction is pointer-based) |
