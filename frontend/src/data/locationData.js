import rawLocationData from '../../../resources/telangana_all_villages.json'

const locationData = rawLocationData || {}

export function getStates() {
  return Object.keys(locationData).sort((a, b) => a.localeCompare(b))
}

export function getDistricts(state) {
  if (!state || !locationData[state]) {
    return []
  }
  return Object.keys(locationData[state]).sort((a, b) => a.localeCompare(b))
}

export function getMandals(state, district) {
  if (!state || !district || !locationData[state] || !locationData[state][district]) {
    return []
  }
  return Object.keys(locationData[state][district]).sort((a, b) => a.localeCompare(b))
}

export function getVillages(state, district, mandal) {
  if (
    !state ||
    !district ||
    !mandal ||
    !locationData[state] ||
    !locationData[state][district] ||
    !locationData[state][district][mandal]
  ) {
    return []
  }

  const villages = locationData[state][district][mandal]
  return [...villages].sort((a, b) => a.localeCompare(b))
}
