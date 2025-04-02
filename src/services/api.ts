import axios from 'axios';
import { Account, ApiResponse, Transaction } from '../types/types';

const API_BASE_URL = 'http://localhost:3004';

interface ApiService {
  fetchAccounts: () => Promise<Account[]>;
  fetchTransactions: (accountId: string) => Promise<ApiResponse<Transaction>>;
  checkForUpdates: (accountId: string, lastLocalUpdate: string | null) => Promise<boolean>;
}

const fetchAccounts = async (): Promise<Account[]> => {
  try {
    const response = await axios.get<Account[]>(`${API_BASE_URL}/accounts`);
    return response.data;

  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }
};

const fetchTransactions = async (
    accountId: string,
    page: number = 1,
    lastId?: string): Promise<ApiResponse<Transaction>> => {
  try {
    const params = { accountId, page, lastId };
    const response = await axios.get<ApiResponse<Transaction>>(`${API_BASE_URL}/transactions`, { params });
    return response.data;

  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

const checkForUpdates = async (accountId: string, lastTransactionId: string | null): Promise<boolean> => {
  try {
    const response = await fetchTransactions(accountId, 1);
    return response.data.length > 0 && response.data[0].transactionId !== lastTransactionId;

  } catch {
    return false;
  }
};

const apiService: ApiService = {
  fetchAccounts,
  fetchTransactions,
  checkForUpdates,
};

export default apiService;
