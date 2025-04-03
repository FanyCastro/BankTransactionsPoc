import axios from 'axios';
import { Account, ApiResponse, Transaction } from '../types/types';

const API_BASE_URL = 'http://localhost:3000';

interface ApiService {
  fetchAccounts: () => Promise<ApiResponse<Account>>;
  fetchTransactionsByAccount: (accountId: string, page: number, size: number) => Promise<ApiResponse<Transaction>>;
  checkForUpdates: (accountId: string, lastLocalUpdate: string | null) => Promise<boolean>;
}

const fetchAccounts = async (): Promise<ApiResponse<Account>> => {
  try {
    const response = await axios.get<ApiResponse<Account>>(`${API_BASE_URL}/accounts`);
    return response.data;

  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }
};

const fetchTransactionsByAccount = async (
    accountId: string,
    page: number = 1,
    size: number = 100): Promise<ApiResponse<Transaction>> => {
  try {
    console.log('***** Fetch all transactions from A API');
    const params = { accountId, ...(page && { page }), ...(size && { size }) };
    const url = `${API_BASE_URL}/accounts/${accountId}/transactions`; 
    const response = await axios.get<ApiResponse<Transaction>>(url, { params });

    if (!response.data || !Array.isArray(response.data.data)) {
      throw new Error('La respuesta no tiene el formato esperado');
    }

    return response.data;

  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

const checkForUpdates = async (accountId: string, lastTransactionId: string | null): Promise<boolean> => {
  try {
    console.log('***** Fetch transactions from API');
    const response: ApiResponse<Transaction> = await fetchTransactions(accountId, 1);
    console.log(`***** CheckForUpdates ${response.data[0].id} == ${lastTransactionId}`);
    return response.data.length > 0 && response.data[0].id !== lastTransactionId;

  } catch {
    return false;
  }
};

const apiService: ApiService = {
  fetchAccounts,
  fetchTransactionsByAccount,
  checkForUpdates,
};

export default apiService;
