import { CachedTransaction, Transaction} from '../types/types';
import { DataState } from '../types/DataState';
import api from '../services/api';
import database from '../services/database';
import { runInAction } from 'mobx';

class TransactionRepository {
    private memoryCache: Map<string, CachedTransaction> = new Map();
    private currentAccountId: string = '';
    private onUpdateCallbacks: ((transactions: CachedTransaction[], isLoading: boolean) => void)[] = [];
    private lastUpdateTimestamp: number = 0;
    private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private readonly PAGE_SIZE = 200;
    private isLoading: boolean = false;

    private abortController: AbortController | null = null;

    private addTransaction(transaction: Transaction): void {
        const cachedTransaction: CachedTransaction = {
            ...transaction,
            mutable: false,
        };
        this.memoryCache.set(cachedTransaction.id, cachedTransaction);
        // const sortedTransactions = Array.from(this.memoryCache.values()).sort(
        //     (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        // );
        // this.memoryCache = new Map(sortedTransactions.map(tx => [tx.id, tx]));
    }

    private getNumberOfTransactionsAfterTransactionId(id: string): any {
        // Get the position of the transaction id as input param in the sorted array 
        // and return the number of transactions after it
        const sortedTransactions = Array.from(this.memoryCache.values()).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const totalMutableTrx : number = sortedTransactions.filter(transaction => transaction.mutable).length;
        const index = sortedTransactions.findIndex(transaction => transaction.id === id);
        if (index === -1) {
            return 0;
        }
        return  { totalTrx: sortedTransactions.length - index - 1, totalMutableTrx: totalMutableTrx };
    }

    private getTransactionById(id: string): CachedTransaction | undefined {
        return this.memoryCache.get(id);
    }

    private deleteTransaction(id: string): void {
        this.memoryCache.delete(id);
    }

    private clearTransactions(): void {
        this.memoryCache.clear();
    }

    // Method to register update callbacks
    onUpdate(callback: (transactions: CachedTransaction[], isLoading: boolean) => void): void {
        this.onUpdateCallbacks.push(callback);
    }

    // Method to notify updates
    private notifyUpdates(): void {
        const transactions = Array.from(this.memoryCache.values());
        this.onUpdateCallbacks.forEach(callback => callback(transactions, this.isLoading));
    }

    private completeUpdate(): void {
        runInAction(() => {
            this.lastUpdateTimestamp = Date.now();
            this.isLoading = false;
        });
        this.notifyUpdates();
    }

    private async fetchFromNetwork(accountId: string): Promise<void> {
        console.log('[TransactionRepository] Starting data refresh');

        // Cancel any ongoing requests
        if (this.abortController) {
            console.log('[TransactionRepository] Aborting previous fetch');
            this.abortController.abort();
        }

        // Create a new AbortController for this request
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        runInAction(() => {
            this.isLoading = true;
        });
        this.notifyUpdates();

        try {
            // Fetch first page synchronously
            const response = await api.fetchTransactionsByAccount(accountId, 0, this.PAGE_SIZE, { signal });
            console.log(`[TransactionRepository] First page fetched: ${response.data.length} transactions, ${response.totalPages} total pages`);

            if (response.data.length === 0) {
                console.log('[TransactionRepository] No transactions found');
                return this.completeUpdate();
            }

            console.log('[TransactionRepository] Persisting first page to database');
            await database.persistTransactions(response.data, accountId);
            console.log('[TransactionRepository] Updating memory cache with first page');
            runInAction(() => {
                response.data.forEach(transaction => this.addTransaction(transaction));
            });
            this.notifyUpdates();

            // Always start fetching additional pages asynchronously if needed
            if (response.totalPages > 1) {
                console.log(`[TransactionRepository] Starting background fetch of ${response.totalPages - 1} additional pages`);
                try {
                    await this.fetchAdditionalPages(
                        response.data[response.data.length - 1].id,
                        response.totalPages,
                        accountId,
                        signal
                    );
                } catch (error: unknown) {
                    console.error('[TransactionRepository] Error in additional pages fetch:', error);
                    runInAction(() => {
                        this.isLoading = false;
                    });
                    this.notifyUpdates();
                }
            } else {
                this.completeUpdate();
            }
        } catch (error: unknown) {
            if (signal.aborted) {
                console.log('[TransactionRepository] Fetch aborted');
            } else {
                console.error('[TransactionRepository] Error fetching first page:', error);
                runInAction(() => {
                    this.isLoading = false;
                });
                this.notifyUpdates();
                throw error;
            }
        } finally {
            this.abortController = null; // Reset the controller
        }
    }

    private async fetchAdditionalPages(
        lastTrxId: string,
        totalPages: number,
        accountId: string,
        signal: AbortSignal
    ): Promise<void> {
        try {
            let page = 1;

            while (page <= totalPages) {
                if (signal.aborted) {
                    console.log('[TransactionRepository] Fetching additional pages aborted');
                    break;
                }

                const dbTrx = await database.getTransactionById(accountId, lastTrxId);
                console.log(`[TransactionRepository] Transaction from database: ${dbTrx?.id}`);

                if (!dbTrx) {
                    console.log(`[TransactionRepository] Transaction ${lastTrxId} not found in database, fetching next page`);
                    const response = await this.fetchAndPersistPage(accountId, page, signal);
                    if (response && response.length > 0) {
                        lastTrxId = response[response.length - 1].id;
                    }
                } else {
                    console.log(`[TransactionRepository] Transaction ${lastTrxId} found in database, checking next page`);
                    const shouldFetchNextPage = this.shouldFetchNextPage(lastTrxId);

                    if (shouldFetchNextPage) {
                        console.log(`[TransactionRepository] Fetching next page, ${page}`);
                        const response = await this.fetchAndPersistPage(accountId, page, signal);
                        if (response && response.length > 0) {
                            lastTrxId = response[response.length - 1].id;
                        }
                    } else {
                        console.log('[TransactionRepository] No mutable transactions found, skipping next page fetch');
                        page += Math.ceil(this.getNumberOfTransactionsAfterTransactionId(lastTrxId).totalTrx / this.PAGE_SIZE);
                        console.log(`[TransactionRepository] Skipping to page ${page}`);
                    }
                }

                if (page >= totalPages) {
                    console.log('[TransactionRepository] All pages processed');
                    break;
                }

                page++;
            }

            console.log('[TransactionRepository] All additional pages processed');
            this.completeUpdate();
        } catch (error: unknown) {
            if (signal.aborted) {
                console.log('[TransactionRepository] Fetching additional pages aborted');
            } else {
                console.error('[TransactionRepository] Error in background pages fetch:', error);
                runInAction(() => {
                    this.isLoading = false;
                });
                this.notifyUpdates();
            }
        }
    }

    private async fetchAndPersistPage(
        accountId: string,
        page: number,
        signal: AbortSignal
    ): Promise<Transaction[]> {
        console.log(`[TransactionRepository] Fetching page ${page}`);
        const response = await api.fetchTransactionsByAccount(accountId, page, this.PAGE_SIZE, { signal });
        console.log(`[TransactionRepository] Persisting page ${page} to database`);
        await database.persistTransactions(response.data, accountId);
        runInAction(() => {
            response.data.forEach(transaction => this.addTransaction(transaction));
        });
        this.notifyUpdates();
        return response.data;
    }

    private shouldFetchNextPage(lastTrxId: string): boolean {
        const {totalTrx, totalMutableTrx} = this.getNumberOfTransactionsAfterTransactionId(lastTrxId);
        console.log(`[TransactionRepository] Found ${totalTrx} transactions in memory after ${lastTrxId}`);
        // const mutableTransactions = localTransactions.filter(t => t.mutable);
        // console.log(`[TransactionRepository] Found ${mutableTransactions.length} mutable transactions in memory after ${lastTrxId}`);
        return totalMutableTrx.length > 0 || totalTrx < this.PAGE_SIZE;
    }

    async getTransactions(accountId: string, forceReload = false): Promise<DataState<CachedTransaction[]>> {
        console.log(`[TransactionRepository] Getting transactions for account ${accountId} (force reload: ${forceReload})`);

        // If account changed, clear cache
        if (this.currentAccountId !== accountId) {
            console.log(`[TransactionRepository] Account changed from ${this.currentAccountId} to ${accountId} - clearing cache`);
            runInAction(() => {
                this.clearTransactions();
                this.currentAccountId = accountId;
                this.lastUpdateTimestamp = 0; // Reset timestamp when account changes
            });
            // copy all transactions from database to memory
            const transactions = await database.getTransactionsByAccountId(accountId);
            console.log(`[TransactionRepository] Loaded ${transactions.length} transactions from database to copy to memory`);
            runInAction(() => {
                transactions.forEach(transaction => this.addTransaction(transaction));
            });
            this.notifyUpdates();
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
    cancelFetch(): void {
        if (this.abortController) {
            console.log('[TransactionRepository] Cancelling ongoing fetch');
            this.abortController.abort();
            this.abortController = null;
        }
    }

    async cleanOldTransactions(): Promise<void> {
        console.log('[TransactionRepository] Starting cleanup of old transactions');
        await database.cleanOldTransactions();
        runInAction(() => {
            this.clearTransactions();
            this.lastUpdateTimestamp = 0;
        });
        this.notifyUpdates();
        console.log('[TransactionRepository] Cleanup completed - cache cleared');
    }
}

export const transactionRepository = new TransactionRepository();
