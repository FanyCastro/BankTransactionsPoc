import { makeAutoObservable, runInAction } from 'mobx';
import { debounce } from '../utils/debounce';
import { transactionRepository } from '../repositories/TransactionRepository';
import { Transaction } from '../types/types';
import { DataState } from '../types/DataState';

export class TransactionStore {
    transactions: Transaction[] = [];
    filteredTransactions: Transaction[] = [];
    currentAccountId: string = '';
    searchQuery: string = '';
    isLoading: boolean = false;
    error: string | null = null;
    private debouncedApplyFilters: ((query: string) => void) & { cancel: () => void };

    constructor() {
        makeAutoObservable(this);
        this.debouncedApplyFilters = debounce(
            (query: string) => this.applyFilters(query),
            300
        );

        // Subscribe to repository updates
        transactionRepository.onUpdate((transactions: Transaction[], isLoading: boolean) => {
            runInAction(() => {
                this.transactions = transactions;
                this.isLoading = isLoading;
                this.applyFilters(this.searchQuery);
            });
        });

        // Clean old transactions every week
        setInterval(() => {
            this.cleanOldTransactions();
        }, 7 * 24 * 60 * 60 * 1000);
    }

    private filterTransaction(transaction: Transaction, queryLower: string): boolean {
        return (
            transaction.description.toLowerCase().includes(queryLower) ||
            transaction.amount.toString().includes(queryLower) ||
            transaction.type.toLowerCase().includes(queryLower)
        );
    }


    private applyFilters(query: string) {
        if (!query) {
            this.filteredTransactions = [...this.transactions];
        } else {
            const queryLower = query.toLowerCase();
            this.filteredTransactions = this.transactions.filter(transaction =>
                this.filterTransaction(transaction, queryLower)
            );
        }
    }

    setAccount(accountId: string) {
        this.currentAccountId = accountId;
        this.error = null;

        transactionRepository.getTransactions(accountId)
            .then((result: DataState<Transaction[]>) => {
                runInAction(() => {
                    this.transactions = result.content;
                    this.isLoading = result.loading;
                    this.error = result.error;
                });
            })
            .catch((error: unknown) => {
                this.handleError(error, 'An error occurred while loading transactions');
            });
    }

    private handleError(error: unknown, defaultMessage: string): void {
        console.error('[TransactionStore] Error:', error);
        runInAction(() => {
            this.error = error instanceof Error ? error.message : defaultMessage;
            this.isLoading = false;
        });
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
        this.debouncedApplyFilters(query);
    }

    private async cleanOldTransactions() {
        try {
            await transactionRepository.cleanOldTransactions();
        } catch (error) {
            console.error('Error cleaning old transactions:', error);
        }
    }

    cleanup() {
        console.log('[TransactionStore] Cleaning up store');
        this.transactions = [];
        this.filteredTransactions = [];
        this.isLoading = false;
        this.error = null;
        this.currentAccountId = '';
        this.searchQuery = '';
        this.debouncedApplyFilters.cancel();
    }

    cancelFetch() {
        transactionRepository.cancelFetch();
      }
}

export const transactionStore = new TransactionStore();
