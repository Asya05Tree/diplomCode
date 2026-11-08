// API параметрів людини (UserProfile) та харчових обмежень (UserTagPreference).
import { apiGet, apiSend } from './http'

export function getHealthProfile() {
  return apiGet('/api/health-profile')
}

// Лише естетичні поля. Стать/статус (гейтинг модулів) змінюються окремо — див. setProfileStatus.
export function setHealthProfile({ height, weight, birthYear }) {
  return apiSend('PUT', '/api/health-profile', { height, weight, birthYear })
}

// Контрольована зміна полів, що керують модулями (стать → Цикл, статус навчання/роботи). Окремий
// ендпойнт, щоб «здоровʼя» не могло самовільно розблоковувати модулі (mass-assignment).
export function setProfileStatus({ gender, studentType, isWorking }) {
  return apiSend('PUT', '/api/account/profile-status', { gender, studentType, isWorking })
}
