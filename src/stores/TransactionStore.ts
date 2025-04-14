import { makeAutoObservable, runInAction } from 'mobx';
import { Transaction } from '../types/types';
import { debounce } from '../utils/debounce';
import { transactionRepository } from '../repositories/TransactionRepository';

class TransactionStore {
    transactions: Transaction[] = [];
    filteredTransactions: Transaction[] = [];
    currentAccountId = '';
    searchQuery = '';
    private debouncedApplyFilters: (query: string) => void;

    constructor() {
        makeAutoObservable(this);
        this.debouncedApplyFilters = debounce(
            (query: string) => this.applyFilters(query),
            300
        );

        // Clean old transactions every week
        setInterval(() => this.cleanOldTransactions(), 604800000);
    }

    private applyFilters(query: string) {
        if (!query) {
            this.filteredTransactions = [...this.transactions];
        } else {
            const queryLower = query.toLowerCase();
            this.filteredTransactions = this.transactions.filter(
                transaction =>
                transaction.description.toLowerCase().includes(queryLower) ||
                transaction.amount.toString().includes(query) ||
                transaction.type.toLowerCase().includes(queryLower)
            );
        }
    }

    async syncTransactions() {
        const result = await transactionRepository.getTransactions(this.currentAccountId, true);

        runInAction(() => {
            if (result.content) {
                this.transactions = result.content;
                this.applyFilters(this.searchQuery);
            }
        });
    }

    async setAccount(accountId: string) {
        if (this.currentAccountId === accountId) { return; }

        runInAction(() => {
            this.currentAccountId = accountId;
            this.transactions = [];
            this.filteredTransactions = [];
            this.searchQuery = '';
        });

        await this.syncTransactions();
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
        this.debouncedApplyFilters(query);
    }

    private async cleanOldTransactions() {
        await transactionRepository.cleanOldTransactions();
        await this.syncTransactions();
    }
}

export const transactionStore = new TransactionStore();
