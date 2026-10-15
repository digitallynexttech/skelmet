/** The admin lists' period menu: days back from now, "0" for all time. */
export const PERIODS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "0", label: "All time" },
]

export const isPeriod = (value: string) => PERIODS.some((p) => p.value === value)
