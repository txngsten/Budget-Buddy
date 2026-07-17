import React from 'react'

interface Props {
  start: string
  end: string
  onChange: (start: string, end: string) => void
}

export default function DateRangeSlider({ start, end, onChange }: Props) {
  return (
    <div className="date-range-slider">
      <label className="date-range-label">
        <span>From</span>
        <input
          type="date"
          className="form-input form-input-date"
          value={start}
          onChange={e => onChange(e.target.value, end)}
        />
      </label>
      <label className="date-range-label">
        <span>To</span>
        <input
          type="date"
          className="form-input form-input-date"
          value={end}
          onChange={e => onChange(start, e.target.value)}
        />
      </label>
    </div>
  )
}
