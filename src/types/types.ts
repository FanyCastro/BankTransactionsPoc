export interface Account {
    id: string;
    accountName: string;
    accountNumber: string; 
    balance: number;
    currency: string;
}

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    currency: string;
    type: string;
    date: string;
}

export interface CachedTransaction extends Transaction {
    mutable: boolean;
}

export interface ApiResponse<T> {
    data: T[];
    totalPages: number;
    total: number;
    page: number;
    size: number;
}

export type RootStackParamList = {
    Home: undefined;
    Accounts: undefined;
    Transactions: { accountId: string };
    MyWebComponent: undefined;
};

export interface AccountCardProps {
    account: Account;
    onPress: () => void;
}

export interface SearchBarProps {
    onChangeText: (text: string) => void;
}

export interface TransactionListProps {
    transactions: Transaction[];
    onRefresh?: () => void;
    refreshing?: boolean;
}

export type TransactionState = {
    // Datos en memoria
    inMemoryTransactions: Transaction[];
    filteredTransactions: Transaction[];

    // Estado de carga
    loading: boolean;
    lastUpdated: Date | null;
    error: string | null;

    // Flags de control
    isCacheValid: boolean;
  };
