const audFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
})

export function formatAud(cents: number): string {
  return audFormatter.format(cents / 100)
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return null
  return Math.round(num * 100)
}
