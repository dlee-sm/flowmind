import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const H2C_OPTS = {
  useCORS: true,
  allowTaint: true,
  scrollX: 0,
  scrollY: 0,
  logging: false,
} as const

// ── Shared capture ────────────────────────────────────────────────────────────

/**
 * Render an element to a canvas at the given pixel ratio.
 * scale=2 → 2× for exports; scale=0.35 → small thumbnail for the preview.
 */
export async function captureCanvas(
  element: HTMLElement,
  scale = 2,
): Promise<HTMLCanvasElement> {
  return html2canvas(element, { ...H2C_OPTS, scale })
}

// ── PNG ───────────────────────────────────────────────────────────────────────

export async function exportToPNG(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureCanvas(element, 2)
  triggerDownload(canvas.toDataURL('image/png'), `${filename}.png`)
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function exportToPDF(
  element: HTMLElement,
  filename: string,
  title: string,
): Promise<void> {
  const canvas  = await captureCanvas(element, 2)
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const pw  = pdf.internal.pageSize.getWidth()
  const ph  = pdf.internal.pageSize.getHeight()
  const mx  = 10   // horizontal margin
  const mt  = 22   // top margin (below title)
  const mb  = 12   // bottom margin (above footer)

  // Purple title header
  pdf.setFontSize(15)
  pdf.setTextColor('#5B2D8E')
  pdf.text(title, pw / 2, 13, { align: 'center' })

  // Diagram image — constrained to page area between header and footer
  const iw = pw - mx * 2
  const ih = Math.min((canvas.height / canvas.width) * iw, ph - mt - mb)
  pdf.addImage(imgData, 'PNG', mx, mt, iw, ih)

  // Date footer
  pdf.setFontSize(8)
  pdf.setTextColor('#999999')
  pdf.text(
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    pw - mx,
    ph - 5,
    { align: 'right' },
  )

  pdf.save(`${filename}.pdf`)
}

// ── SVG ───────────────────────────────────────────────────────────────────────

/**
 * Generates a proper vector SVG from the React Flow canvas.
 *
 * Strategy:
 *   1. Parse the .react-flow__viewport CSS transform to get pan (tx,ty) and zoom (scale).
 *   2. Copy the React Flow edges SVG layer verbatim — paths are already in flow coordinates.
 *   3. Measure each node's screen rect, un-project it back to flow coordinates, and draw
 *      a proper vector shape (rect / diamond / pill / circle) matching the node type.
 *
 * Result: a standalone SVG with no raster images that can be opened in Illustrator or Inkscape.
 */
export function exportToSVG(canvasElement: HTMLElement, filename: string): void {
  const viewport = canvasElement.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport) return

  // Parse: "translate(Xpx, Ypx) scale(S)"
  const m  = viewport.style.transform.match(
    /translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/,
  )
  const tx    = m ? parseFloat(m[1]) : 0
  const ty    = m ? parseFloat(m[2]) : 0
  const scale = m ? parseFloat(m[3]) : 1

  const cw = canvasElement.offsetWidth
  const ch = canvasElement.offsetHeight
  const cr = canvasElement.getBoundingClientRect()

  const lines: string[] = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}">`)
  lines.push(`  <rect width="${cw}" height="${ch}" fill="#F9F7F4"/>`)
  lines.push(`  <g transform="translate(${tx},${ty}) scale(${scale})">`)

  // ── Edge layer: copy the React Flow SVG inner content ─────────────────────
  const edgesSvg = canvasElement.querySelector<SVGElement>('svg.react-flow__edges')
  if (edgesSvg) {
    // Pull defs (arrowhead markers) to the top of the group
    const defs = edgesSvg.querySelector('defs')
    if (defs) lines.push(`    ${defs.outerHTML}`)
    for (const child of Array.from(edgesSvg.children)) {
      if (child.tagName !== 'defs') lines.push(`    ${child.outerHTML}`)
    }
  }

  // ── Node layer: generate proper vector shapes from DOM positions ──────────
  const nodeEls = canvasElement.querySelectorAll<HTMLElement>('.react-flow__node')
  for (const el of Array.from(nodeEls)) {
    const r  = el.getBoundingClientRect()
    // Un-project screen position → flow coordinates
    const nx = (r.left - cr.left - tx) / scale
    const ny = (r.top  - cr.top  - ty) / scale
    const nw = r.width  / scale
    const nh = r.height / scale

    // React Flow adds "react-flow__node-{type}" to each node element
    const type = Array.from(el.classList)
      .find((c) => c.startsWith('react-flow__node-'))
      ?.replace('react-flow__node-', '') ?? 'process'

    const label = el.querySelector('span')?.textContent?.trim() ?? ''

    lines.push(renderNodeSVG(type, nx, ny, nw, nh, label))
  }

  lines.push('  </g>')
  lines.push('</svg>')

  const blob = new Blob([lines.join('\n')], { type: 'image/svg+xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  triggerDownload(url, `${filename}.svg`)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href     = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function escSVG(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderNodeSVG(
  type: string,
  x: number, y: number, w: number, h: number,
  label: string,
): string {
  const cx  = x + w / 2
  const cy  = y + h / 2
  const lbl = escSVG(label)

  const text = (fill: string, dy = 0) =>
    `      <text x="${cx}" y="${cy + dy}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="${fill}">${lbl}</text>`

  switch (type) {
    case 'decision': {
      const pts = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`
      return [
        `      <polygon points="${pts}" fill="#F39C12"/>`,
        text('#FFFFFF'),
      ].join('\n')
    }

    case 'startEnd':
      return [
        `      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#00B5AD"/>`,
        text('#FFFFFF'),
      ].join('\n')

    case 'mindmap':
      return [
        `      <circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) / 2}" fill="#E8E4F0" stroke="#D5D0E5" stroke-width="1.5"/>`,
        text('#1A1A2E'),
      ].join('\n')

    case 'swimlane': {
      const hw = 24  // header band height
      return [
        `      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#FFFFFF" stroke="#D5D0E5" stroke-width="1.5"/>`,
        `      <rect x="${x}" y="${y}" width="${w}" height="${hw}" rx="6" fill="#E8E4F0"/>`,
        // square off the bottom of the header so it sits flush
        `      <rect x="${x}" y="${y + hw - 5}" width="${w}" height="5" fill="#E8E4F0"/>`,
        // lane label in header
        `      <text x="${cx}" y="${y + hw / 2}" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="Inter,sans-serif" font-size="9" font-weight="700" fill="#5B2D8E">${lbl}</text>`,
      ].join('\n')
    }

    default: // process
      return [
        `      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#5B2D8E"/>`,
        text('#FFFFFF'),
      ].join('\n')
  }
}
