import type { User } from '../types';
import { GasAPI, saveAuthToken, clearAuthToken } from '../utils/gas-wrapper';

let currentUser: User | null = null;

export const AuthService = {
  getCurrentUser: () => currentUser,

  setCurrentUser: (user: User) => {
    currentUser = user;
  },

  clearCurrentUser: () => {
    currentUser = null;
  },

  login: async (username: string, password: string): Promise<User> => {
    const result = await GasAPI.login(username, password);
    if (!result.success) {
      throw new Error(result.message || 'Login gagal');
    }
    if (result.token) {
      saveAuthToken(result.token);
    }
    currentUser = result;
    return result;
  },

  logout: () => {
    currentUser = null;
    clearAuthToken();
    try {
      GasAPI.logout?.().catch(() => {});
    } catch {
      // abaikan
    }
  },

  isLoggedIn: (): boolean => currentUser !== null,

  isAdmin: (): boolean => currentUser?.role === 'admin',

  getUserName: (): string => currentUser?.nama || '',

  getUserCabang: (): string => currentUser?.cabang || '',

  canEditSuratJalan: (cabangAsal: string, status: string): boolean => {
    if (!currentUser) return false;
    const bisaEditStatus = status === 'Dikirim' || status === 'Menunggu Penerimaan';
    if (!bisaEditStatus) return false;
    if (currentUser.role === 'admin') return true;
    return cabangAsal === currentUser.cabang;
  },
};