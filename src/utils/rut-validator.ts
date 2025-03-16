function getVerifier (rutDigits: string): string {
  let sum = 0
  let multiplier = 2

  for (let i = rutDigits.length - 1; i >= 0; i--) {
    sum += parseInt(rutDigits[i], 10) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const remainder = sum % 11
  const verifier = 11 - remainder

  if (verifier === 11) {
    return '0'
  } else if (verifier === 10) {
    return 'k'
  } else {
    return verifier.toString()
  }
}

export function rutValidate (rut: string): boolean {
  if (rut === undefined || rut === null || rut === '') {
    return false
  }

  const rutClean = rut.replace(/[^0-9kK]/g, '').toLowerCase()
  if (rutClean.length < 8) {
    return false
  }

  const rutDigits = rutClean.slice(0, -1)
  const rutVerifier = rutClean.slice(-1)
  const rutVerifierExpected = getVerifier(rutDigits)

  return rutVerifier === rutVerifierExpected
}
