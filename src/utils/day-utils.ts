import dayjs from 'dayjs'

export const DayUtils = {
  formatDate (dateStr: string, format: string = 'DD/MM/YYYY'): string {
    const formattedDate = dateStr.replace(/^(\d{8})T.*$/, '$1')
    const date = dayjs(formattedDate, 'YYYYMMDD')
    return date.format(format)
  },

  getCurrentDate (format: string = 'YYYY-MM-DD'): string {
    return dayjs().format(format)
  },

  getCurrentDateTimeInCustomFormat (format: string = 'YYYYMMDDTHH:mm:ss+0000'): string {
    return dayjs().format(format)
  },

  calculateDateDifference (startDate: string, endDate: string): number {
    return dayjs(endDate).diff(dayjs(startDate), 'day')
  }
}
