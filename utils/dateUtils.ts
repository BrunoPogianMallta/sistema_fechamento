export function getOperationalDate(date: Date): string {
  const hours = date.getHours()

  // Se for entre 00:00 e 01:00, considera como parte do dia anterior
  if (hours < 1) {
    const previousDay = new Date(date)
    previousDay.setDate(previousDay.getDate() - 1)
    return previousDay.toISOString().split("T")[0]
  }

  return date.toISOString().split("T")[0]
}
