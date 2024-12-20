// ./utils/dates.ts

import { PollProps } from '../types'

export const convertVoteDateToUnixxx = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Math.floor(date.getTime() / 1000)
}

export const formatVoteDateStrOnChainnn = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-') // Expected input: "YYYY-MM-DD"
  return `${day}/${month}/${year}` // Expected output: "DD/MM/YYYY"
}

export const validateVoteDatesss = (startUnix: number, endUnix: number): string => {
  // const normalizeToStartOfDay = (timestamp: number): number => Math.floor(new Date(timestamp * 1000).setHours(0, 0, 0, 0) / 1000)
  // const currentUnix = Math.floor(Date.now() / 1000) // current unix timestamp
  const minVotePeriod = 3 * 24 * 60 * 60 // 3 days in seconds
  const maxVotePeriod = 14 * 24 * 60 * 60 // 14 days in seconds

  // if (normalizeToStartOfDay(startUnix) < normalizeToStartOfDay(currentUnix)) {
  //   return 'Invalid dates! Start date must not be earlier than current date.'
  // }

  const votePeriod = endUnix - startUnix

  // if (startUnix < currentUnix) return 'Invalid dates! Start date must not be earlier than current date'
  // if (endUnix <= currentUnix) return 'Invalid dates! End date must not be earlier than current date'
  if (startUnix > endUnix) return 'Invalid dates! Start date must be earlier than end date'
  if (votePeriod < minVotePeriod) return 'Invalid dates! End date must be at least 3 days later than start date'
  if (votePeriod > maxVotePeriod) return 'Invalid dates! Voting period must not exceed a maximum of 14 days'

  return 'vote dates valid!'
}

export const processPollInputs = (
  pollParams: PollProps,
  isPollActive: boolean,
  setUserMsg: (notification: { msg: string; style: string }) => void,
): boolean => {
  if (!isPollActive) return false

  const { title, choices, startDate, endDate } = pollParams

  // Validate title
  if (!title) {
    setUserMsg({ msg: 'Poll title required', style: 'text-red-700 font-bold' })
    return false
  }

  // Validate choices
  const missingChoice = choices.findIndex((choice) => !choice || choice.trim() === '') + 1
  if (missingChoice) {
    setUserMsg({ msg: `Choice #${missingChoice} is required`, style: 'text-red-700 font-bold' })
    return false
  }

  // Validate dates
  if (!startDate || !endDate) {
    setUserMsg({ msg: 'Start and end date required', style: 'text-red-700 font-bold' })
    return false
  }

  const startDateUnix = convertVoteDateToUnixxx(startDate)
  const endDateUnix = convertVoteDateToUnixxx(endDate)
  const validationError = validateVoteDatesss(startDateUnix, endDateUnix)
  if (validationError !== 'vote dates valid!') {
    setUserMsg({ msg: validationError, style: 'text-red-700 font-bold' })
    return false
  }

  // All validations passed
  setUserMsg({ msg: "All information valid, click 'Create' to initialize poll", style: 'text-green-700 font-bold' })
  return true
}

export const isVotingOpennn = (pollParams: PollProps): { isOpen: boolean; message: string } => {
  const { startDate, endDate } = pollParams

  const startUnix = convertVoteDateToUnixxx(startDate)
  const endUnix = convertVoteDateToUnixxx(endDate)

  // Get the current Unix time
  const currentUnix = Math.floor(Date.now() / 1000)

  // Determine if voting is open
  if (currentUnix >= startUnix && currentUnix <= endUnix) {
    return { isOpen: true, message: 'Yes' }
  } else {
    return { isOpen: false, message: 'No' }
  }
}

export const setUserVisualAidForDatesss = (date: string, pollParams: PollProps) => {
  if (date === pollParams.startDate || date === pollParams.endDate) {
    const { startDate, endDate } = pollParams

    if (!startDate || !endDate) {
      return 'border-2 border-red-500' // Dates are missing
    }

    const startUnix = convertVoteDateToUnixxx(startDate)
    const endUnix = convertVoteDateToUnixxx(endDate)

    const validationMessage = validateVoteDatesss(startUnix, endUnix)
    return validationMessage === 'vote dates valid!' ? 'border-2 border-green-500' : 'border-2 border-red-500' // Valid or invalid dates
  }

  return 'border-2 border-gray-300' // Default for other fields
}

export const confirmPollValidityyy = (pollParams: PollProps, setUserMsg: (notification: { msg: string; style: string }) => void) => {
  const { title, choices, startDate, endDate } = pollParams

  // Ensure all fields are populated
  if (!title || choices.some((choice) => !choice) || !startDate || !endDate) {
    return false // One or more fields are incomplete
  }

  // Ensure start date is before end date and within the valid range
  const startUnix = convertVoteDateToUnixxx(startDate)
  const endUnix = convertVoteDateToUnixxx(endDate)

  const validationMessage = validateVoteDatesss(startUnix, endUnix)
  if (validationMessage !== 'vote dates valid!') {
    setUserMsg({ msg: validationMessage, style: 'text-red-700 font-bold' }) // Log the validation failure message
    return false // Return false if the validation fails
  }

  return true // Return true if the poll is valid
}
