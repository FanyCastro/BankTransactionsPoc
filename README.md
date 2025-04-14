# Bank Transactions POC

A proof of concept for handling bank transactions with background updates and efficient state management.

## Architecture

The application follows a repository pattern with MobX for state management:

### Repository Layer (`TransactionRepository`)

Responsible for data management and background operations:

```typescript
class TransactionRepository {
    private memoryCache: Map<string, Transaction>;
    private onUpdateCallbacks: ((transactions: Transaction[], isLoading: boolean) => void)[];
    private isLoading: boolean;

    // Notifies subscribers of updates with current transactions and loading state
    onUpdate(callback: (transactions: Transaction[], isLoading: boolean) => void): void;
}
```

Key features:
- Manages loading state internally
- Handles background page fetching
- Notifies subscribers of both data and loading state changes
- Maintains a memory cache for quick access

### Store Layer (`TransactionStore`)

Handles UI state and repository interactions:

```typescript
export class TransactionStore {
    transactions: Transaction[] = [];
    isLoading: boolean = false;
    
    constructor() {
        // Subscribe to repository updates
        transactionRepository.onUpdate((transactions, isLoading) => {
            runInAction(() => {
                this.transactions = transactions;
                this.isLoading = isLoading;
                this.applyFilters(this.searchQuery);
            });
        });
    }
}
```

Key features:
- Reflects repository loading state
- Handles filtering and search
- Manages UI-specific state

## Data Flow

1. Initial Load:
   ```typescript
   // User navigates to transactions
   store.setAccount(accountId);
   // Repository starts loading and notifies
   repository.getTransactions(accountId);
   ```

2. Background Updates:
   ```typescript
   // Repository loads first page
   this.fetchFromNetwork(accountId);
   // Then starts background loading of additional pages
   this.fetchAdditionalPages(totalPages, accountId);
   ```

3. State Updates:
   ```typescript
   // Repository notifies of changes
   this.onUpdateCallbacks.forEach(callback => 
       callback(transactions, this.isLoading)
   );
   ```

## Loading State Management

The loading state follows these rules:

1. Repository controls loading state:
   - Sets `isLoading = true` when starting data fetch
   - Sets `isLoading = false` when:
     - First page is loaded (if no more pages)
     - All additional pages are loaded
     - An error occurs

2. Store reflects loading state:
   - Updates its `isLoading` based on repository notifications
   - Uses loading state for UI feedback

## Best Practices

1. State Management:
   - Single source of truth in repository
   - MobX strict mode compliance
   - Proper error handling

2. Background Processing:
   - Non-blocking page loading
   - Progressive data updates
   - Efficient memory cache

3. Error Handling:
   - Graceful error recovery
   - User feedback
   - Logging for debugging

## Implementation Details

### Repository Updates

```typescript
private async fetchAdditionalPages(totalPages: number, accountId: string): Promise<void> {
    try {
        for (let page = 2; page <= totalPages; page++) {
            // Fetch and process each page
            const response = await api.fetchTransactionsByAccount(accountId, page, 200);
            // Update cache and notify
            runInAction(() => {
                response.data.forEach(transaction => {
                    this.memoryCache.set(transaction.id, transaction);
                });
            });
            this.notifyUpdates();
        }
        // Mark loading as complete
        runInAction(() => {
            this.lastUpdateTimestamp = Date.now();
            this.isLoading = false;
        });
        this.notifyUpdates();
    } catch (error) {
        console.error('[TransactionRepository] Error in background pages fetch:', error);
        runInAction(() => {
            this.isLoading = false;
        });
        this.notifyUpdates();
    }
}
```

### Store Updates

```typescript
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
        });
}
```

## Getting Started

1. **Installation**
   ```