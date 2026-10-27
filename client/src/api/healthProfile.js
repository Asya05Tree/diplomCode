// API параметрів людини (UserProfile) та харчових обмежень (UserTagPreference).
import { apiGet, apiSend } from './http'

export function getHealthProfile() {
  return apiGet('/api/health-profile')
}

export function setHealthProfile({ height, weight, birthYear, gender }) {
  return apiSend('PUT', '/api/health-profile', { height, weight, birthYear, gender })
}

export function getRestrictions() {
  return apiGet('/api/health-profile/restrictions')
}

export function setRestriction({ tagKey, relation, weight }) {
  return apiSend('PUT', '/api/health-profile/restrictions', { tagKey, relation, weight: weight ?? null })
}

export function removeRestriction(tagKey) {
  return apiSend('DELETE', `/api/health-profile/restrictions/${encodeURIComponent(tagKey)}`)
}
