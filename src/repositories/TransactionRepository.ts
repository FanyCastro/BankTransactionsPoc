import { Transaction } from '../types/types';
import { DataState } from '../types/DataState';
import api from '../services/api';
import database from '../services/database';
import { runInAction } from 'mobx';

class TransactionRepository {
    private memoryCache: Map<string, Transaction> = new Map();
    private currentAccountId: string = '';
    private onUpdateCallbacks: ((transactions: Transaction[], isLoading: boolean) => void)[] = [];
    private lastUpdateTimestamp: number = 0;
    private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private readonly PAGE_SIZE = 200;
    private isLoading: boolean = false;

    // Method to register update callbacks
    onUpdate(callback: (transactions: Transaction[], isLoading: boolean) => void): void {
        this.onUpdateCallbacks.push(callback);
    }

    // Method to notify updates
    private notifyUpdates(): void {
        const transactions = Array.from(this.memoryCache.values());
        this.onUpdateCallbacks.forEach(callback => callback(transactions, this.isLoading));
    }

    private async fetchFromNetwork(accountId: string): Promise<void> {
        console.log('[TransactionRepository] Starting data refresh');
        runInAction(() => {
            this.isLoading = true;
        });
        this.notifyUpdates();

        try {
            // Fetch first page synchronously
            const response = await api.fetchTransactionsByAccount(accountId, 1, this.PAGE_SIZE);
            console.log(`[TransactionRepository] First page fetched: ${response.data.length} transactions, ${response.totalPages} total pages`);

            if (response.data.length > 0) {
                console.log('[TransactionRepository] Persisting first page to database');
                await database.persistTransactions(response.data, accountId);

                console.log('[TransactionRepository] Updating memory cache with first page');
                runInAction(() => {
                    response.data.forEach(transaction => {
                        this.memoryCache.set(transaction.id, transaction);
                    });
                });

                this.notifyUpdates();

                // Start fetching additional pages asynchronously if needed
                if (response.totalPages > 1) {
                    console.log(`[TransactionRepository] Starting background fetch of ${response.totalPages - 1} additional pages`);
                    this.fetchAdditionalPages(response.totalPages, accountId);
                } else {
                    runInAction(() => {
                        this.lastUpdateTimestamp = Date.now();
                        this.isLoading = false;
                    });
                    this.notifyUpdates();
                }
            } else {
                console.log('[TransactionRepository] No transactions found in first page');
                runInAction(() => {
                    this.lastUpdateTimestamp = Date.now();
                    this.isLoading = false;
                });
                this.notifyUpdates();
            }
        } catch (error: unknown) {
            console.error('[TransactionRepository] Error fetching first page:', error);
            runInAction(() => {
                this.isLoading = false;
            });
            this.notifyUpdates();
            throw error;
        }
    }

    private async fetchAdditionalPages(totalPages: number, accountId: string): Promise<void> {
        try {
            for (let page = 2; page <= totalPages; page++) {
                try {
                    console.log(`[TransactionRepository] Fetching page ${page} of ${totalPages}`);
                    const response = await api.fetchTransactionsByAccount(accountId, page, this.PAGE_SIZE);

                    if (response.data.length > 0) {
                        await database.persistTransactions(response.data, accountId);
                        runInAction(() => {
                            response.data.forEach(transaction => {
                                this.memoryCache.set(transaction.id, transaction);
                            });
                        });
                        this.notifyUpdates();
                    }
                } catch (error: unknown) {
                    console.error(`[TransactionRepository] Error fetching page ${page}:`, error);
                }
            }
            console.log('[TransactionRepository] All additional pages processed');
            runInAction(() => {
                this.lastUpdateTimestamp = Date.now();
                this.isLoading = false;
            });
            this.notifyUpdates();
        } catch (error: unknown) {
            console.error('[TransactionRepository] Error in background pages fetch:', error);
            runInAction(() => {
                this.isLoading = false;
            });
            this.notifyUpdates();
        }
    }

    async getTransactions(accountId: string, forceReload = false): Promise<DataState<Transaction[]>> {
        console.log(`[TransactionRepository] Getting transactions for account ${accountId} (force reload: ${forceReload})`);

        // If account changed, clear cache
        if (this.currentAccountId !== accountId) {
            console.log(`[TransactionRepository] Account changed from ${this.currentAccountId} to ${accountId} - clearing cache`);
            runInAction(() => {
                this.memoryCache.clear();
                this.currentAccountId = accountId;
                this.lastUpdateTimestamp = 0; // Reset timestamp when account changes
            });
        }

        // Always return current cache
        const transactions = Array.from(this.memoryCache.values());
        console.log(`[TransactionRepository] Returning ${transactions.length} cached transactions`);

        // Check if we need to update
        const now = Date.now();
        const shouldUpdate = forceReload || (now - this.lastUpdateTimestamp > this.UPDATE_INTERVAL);
        console.log(`[TransactionRepository] Update needed: ${shouldUpdate} (force reload: ${forceReload}, time since last update: ${Math.round((now - this.lastUpdateTimestamp) / 1000)}s)`);

        // If we need to update, schedule it in the background
        if (shouldUpdate) {
            console.log('[TransactionRepository] Scheduling background update');
            runInAction(() => {
                this.isLoading = true;
            });
            this.notifyUpdates();
            this.fetchFromNetwork(accountId).catch((error: unknown) => {
                console.error('[TransactionRepository] Error in background update:', error);
            });
        }

        // Return current state
        return {
            content: transactions,
            loading: this.isLoading,
            error: null,
        };
    }

    async cleanOldTransactions(): Promise<void> {
        console.log('[TransactionRepository] Starting cleanup of old transactions');
        await database.cleanOldTransactions();
        runInAction(() => {
            this.memoryCache.clear();
            this.lastUpdateTimestamp = 0;
        });
        this.notifyUpdates();
        console.log('[TransactionRepository] Cleanup completed - cache cleared');
    }
}

export const transactionRepository = new TransactionRepository();
