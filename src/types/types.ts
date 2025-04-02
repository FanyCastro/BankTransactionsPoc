export interface Account {
    accountId: string;
    name: string;
    balance: number;
    currency: string;
}
  
export interface Transaction {
    transactionId: string;
    accountId: string;
    description: string;
    amount: number | string;
    currency: string; 
    category: string;
    date: string;
}

export interface ApiResponse<T> {
    data: T[];
    total: number;
    page: number;
    perPage: number;
    lastId?: string;
}

export type RootStackParamList = {
Accounts: undefined;
Transactions: { accountId: string };
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

  