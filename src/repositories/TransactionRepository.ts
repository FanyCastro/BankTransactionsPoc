import { Transaction } from '../types/types';
import api from '../services/api';
import database from '../services/database';

interface DataState<T> {
    content: T | null;
    loading: boolean;
    error: Error | null;
}

class TransactionRepository {
    private memoryCache: Transaction[] = [];
    private currentAccountId: string = '';
    private isCheckingForUpdates: boolean = false;

    async getTransactions(accountId: string, forceReload = false): Promise<DataState<Transaction[]>> {
        console.log(`[TransactionRepository] getTransactions called for account ${accountId}, forceReload: ${forceReload}`);

        // If account changed, clear cache
        if (this.currentAccountId !== accountId) {
            console.log(`[TransactionRepository] Account changed from ${this.currentAccountId} to ${accountId}, clearing cache`);
            this.memoryCache = [];
            this.currentAccountId = accountId;
        }

        // 1. Return memory cache immediately if available
        if (this.memoryCache.length > 0) {
            console.log(`[TransactionRepository] Returning ${this.memoryCache.length} transactions from memory cache`);

            // Check for updates in the background if not forcing reload
            if (!forceReload && !this.isCheckingForUpdates) {
                console.log('[TransactionRepository] Triggering background update check');
                this.checkForUpdates(accountId);
            }

            return {
                content: this.memoryCache,
                loading: false,
                error: null,
            };
        }

        // 2. Try DB if memory cache is empty
        if (this.memoryCache.length === 0) {
            console.log('[TransactionRepository] Memory cache empty, trying DB');
            try {
                const dbData = await database.getTransactionsByAccountId(accountId);
                if (dbData.length > 0) {
                    console.log(`[TransactionRepository] Found ${dbData.length} transactions in DB`);
                    this.memoryCache = dbData;

                    // Check for updates in the background
                    if (!this.isCheckingForUpdates) {
                        console.log('[TransactionRepository] Triggering background update check after DB load');
                        this.checkForUpdates(accountId);
                    }

                    return {
                        content: dbData,
                        loading: false,
                        error: null,
                    };
                } else {
                    console.log('[TransactionRepository] No transactions found in DB');
                }
            } catch (error) {
                console.error('[TransactionRepository] Error loading from DB:', error);
            }
        }

        // 3. Fetch from network (only if cache is empty or force reload)
        console.log('[TransactionRepository] Fetching from network');
        return this.fetchFromNetwork(accountId);
    }

    private async checkForUpdates(accountId: string) {
        if (this.isCheckingForUpdates) {
            console.log('[TransactionRepository] Already checking for updates, skipping');
            return;
        }

        console.log(`[TransactionRepository] Starting background update check for account ${accountId}`);
        this.isCheckingForUpdates = true;

        try {
            // Check if there are new transactions
            console.log('[TransactionRepository] Fetching latest transaction to check for updates');
            const response = await api.fetchTransactionsByAccount(accountId, 1, 1);

            if (response.data.length > 0) {
                const newestTransaction = response.data[0];
                console.log(`[TransactionRepository] Latest transaction ID: ${newestTransaction.id}`);

                const existsLocally = await database.getTransactionById(newestTransaction.id) != null;
                console.log(`[TransactionRepository] Latest transaction exists locally: ${existsLocally}`);

                if (!existsLocally) {
                    console.log('[TransactionRepository] New transactions found, fetching all');
                    // There are new transactions, fetch them all
                    await this.fetchFromNetwork(accountId);
                } else {
                    console.log('[TransactionRepository] No new transactions found');
                }
            } else {
                console.log('[TransactionRepository] No transactions returned from API');
            }
        } catch (error) {
            console.error('[TransactionRepository] Error checking for updates:', error);
        } finally {
            this.isCheckingForUpdates = false;
            console.log('[TransactionRepository] Background update check completed');
        }
    }

    private async fetchFromNetwork(accountId: string): Promise<DataState<Transaction[]>> {
        console.log(`[TransactionRepository] Fetching transactions from network for account ${accountId}`);
        try {
            const response = await api.fetchTransactionsByAccount(accountId, 1, 200);
            console.log(`[TransactionRepository] Network response: ${response.data.length} transactions, ${response.totalPages} pages`);

            if (response.data.length > 0) {
                // Save to DB
                console.log(`[TransactionRepository] Saving ${response.data.length} transactions to DB`);
                await database.persistTransactions(response.data, accountId);

                // Update memory cache
                console.log(`[TransactionRepository] Updating memory cache with ${response.data.length} transactions`);
                this.memoryCache = response.data;

                // Handle other pages if needed
                if (response.totalPages > 1) {
                    console.log(`[TransactionRepository] Fetching ${response.totalPages - 1} additional pages`);
                    await this.handleOtherPages(response, accountId);
                }

                return {
                    content: this.memoryCache,
                    loading: false,
                    error: null,
                };
            }
        } catch (error) {
            console.error('[TransactionRepository] Error fetching from network:', error);
            // If we have cached data, return it with error
            if (this.memoryCache.length > 0) {
                console.log(`[TransactionRepository] Returning ${this.memoryCache.length} cached transactions with error`);
                return {
                    content: this.memoryCache,
                    loading: false,
                    error: error as Error,
                };
            }
            console.log('[TransactionRepository] No cached data available, returning error');
            return {
                content: null,
                loading: false,
                error: error as Error,
            };
        }

        console.log('[TransactionRepository] No transactions found, returning empty array');
        return {
            content: [],
            loading: false,
            error: null,
        };
    }

    private async handleOtherPages(firstPageResponse: any, accountId: string) {
        const totalPages = firstPageResponse.totalPages;
        console.log(`[TransactionRepository] Handling ${totalPages - 1} additional pages`);

        const pagePromises = [];
        for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
            console.log(`[TransactionRepository] Fetching page ${currentPage}`);
            pagePromises.push(
                api.fetchTransactionsByAccount(accountId, currentPage, 200)
            );
        }

        console.log('[TransactionRepository] Waiting for all page responses');
        const pagesResponses = await Promise.all(pagePromises);

        const newTransactions: Transaction[] = [];
        for (const pageResponse of pagesResponses) {
            if (pageResponse.data.length > 0) {
                console.log(`[TransactionRepository] Page response: ${pageResponse.data.length} transactions`);
                newTransactions.push(...pageResponse.data);
            }
        }

        if (newTransactions.length > 0) {
            console.log(`[TransactionRepository] Saving ${newTransactions.length} additional transactions to DB`);
            await database.persistTransactions(newTransactions, accountId);

            console.log(`[TransactionRepository] Adding ${newTransactions.length} transactions to memory cache`);
            this.memoryCache.push(...newTransactions);
        } else {
            console.log('[TransactionRepository] No additional transactions found in other pages');
        }
    }

    async cleanOldTransactions(): Promise<void> {
        console.log('[TransactionRepository] Cleaning old transactions');
        await database.cleanOldTransactions();
        this.memoryCache = [];
        console.log('[TransactionRepository] Memory cache cleared after cleaning old transactions');
    }
}

export const transactionRepository = new TransactionRepository();
