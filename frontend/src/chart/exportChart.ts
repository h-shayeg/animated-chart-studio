import { SVGRenderer } from 'echarts/renderers'

import type { ChartOption } from './buildOption'
import { echarts, toEChartsOption, type ECharts } from './echartsSetup'
import type { ExportFormat } from './formats'

echarts.use([SVGRenderer])

// How long the finished chart stays on screen at the end of a recording.
const HOLD_MS = 800
const VIDEO_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export interface ExportContext {
  chart: ECharts
  option: ChartOption
  title: string
  dark: boolean
  durationMs: number
  onProgress?: (fraction: number) => void
}

function backgroundOf(dark: boolean): string {
  return dark ? '#0f172a' : '#ffffff'
}

function fileName(title: string, extension: string): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'chart'
  return `${base}.${extension}`
}

function save(content: Blob | string, name: string): void {
  const url = typeof content === 'string' ? content : URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  if (typeof content !== 'string') setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function exportImage(context: ExportContext, format: 'png' | 'jpeg'): void {
  const url = context.chart.getDataURL({
    type: format,
    pixelRatio: 2,
    backgroundColor: backgroundOf(context.dark),
  })
  save(url, fileName(context.title, format === 'jpeg' ? 'jpg' : 'png'))
}

export interface PictureContext {
  option: ChartOption
  // The size of the picture in CSS pixels.
  width: number
  height: number
  title: string
  dark: boolean
}

function finished(context: PictureContext) {
  return toEChartsOption({
    ...context.option,
    animation: false,
    backgroundColor: backgroundOf(context.dark),
  })
}

function saveSvg(context: PictureContext): void {
  const svgChart = echarts.init(null, context.dark ? 'dark' : undefined, {
    renderer: 'svg',
    ssr: true,
    width: context.width,
    height: context.height,
  })
  svgChart.setOption(finished(context))
  const svg = svgChart.renderToSVGString()
  svgChart.dispose()
  save(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName(context.title, 'svg'))
}

function exportSvg(context: ExportContext): void {
  const dom = context.chart.getDom()
  saveSvg({ ...context, width: dom.clientWidth, height: dom.clientHeight })
}

// Draws an option on a chart of its own, away from the page, and saves it as a picture.
// The chart on the page is left alone, so the picture can differ from it (no zoom slider).
export function exportPicture(format: 'png' | 'jpeg' | 'svg', context: PictureContext): void {
  if (format === 'svg') {
    saveSvg(context)
    return
  }
  const chart = echarts.init(document.createElement('div'), context.dark ? 'dark' : undefined, {
    renderer: 'canvas',
    width: context.width,
    height: context.height,
  })
  chart.setOption(finished(context))
  const url = chart.getDataURL({
    type: format,
    pixelRatio: 2,
    backgroundColor: backgroundOf(context.dark),
  })
  chart.dispose()
  save(url, fileName(context.title, format === 'jpeg' ? 'jpg' : 'png'))
}

async function exportVideo(context: ExportContext): Promise<void> {
  const canvas = context.chart.getDom().querySelector('canvas')
  const mimeType =
    typeof MediaRecorder === 'undefined'
      ? undefined
      : VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
  if (!canvas || !mimeType) throw new Error('This browser cannot record video.')

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener('stop', () => resolve())
  })

  // Play the animation again on a solid background, because a video has no transparent areas.
  context.chart.clear()
  context.chart.setOption(
    toEChartsOption({
      ...context.option,
      animation: true,
      backgroundColor: backgroundOf(context.dark),
    }),
    { notMerge: true },
  )
  recorder.start()

  const total = context.durationMs + HOLD_MS
  const startedAt = performance.now()
  const timer = setInterval(() => {
    context.onProgress?.(Math.min((performance.now() - startedAt) / total, 1))
  }, 200)
  await new Promise((resolve) => setTimeout(resolve, total))
  clearInterval(timer)

  recorder.stop()
  await stopped
  stream.getTracks().forEach((track) => track.stop())
  context.chart.setOption(toEChartsOption({ ...context.option, animation: false }), {
    notMerge: true,
  })
  save(new Blob(chunks, { type: 'video/webm' }), fileName(context.title, 'webm'))
}

export async function exportChart(format: ExportFormat, context: ExportContext): Promise<void> {
  if (format === 'png' || format === 'jpeg') exportImage(context, format)
  else if (format === 'svg') exportSvg(context)
  else await exportVideo(context)
}
