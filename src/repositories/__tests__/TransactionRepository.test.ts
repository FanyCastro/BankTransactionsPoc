import { transactionRepository } from '../TransactionRepository';
import database from '../../services/database';
import api from '../../services/api';

jest.mock('../../services/database');
jest.mock('../../services/api');

describe('TransactionRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        transactionRepository['memoryCache'] = new Map(); // Inicializar como Map
        transactionRepository['currentAccountId'] = '';
        transactionRepository['lastUpdateTimestamp'] = 0;
    });

    it('should fetch transactions from the network and update the cache', async () => {
        const mockTransactions = [
            { id: 'trx1', date: '2025-04-01', mutable: false },
            { id: 'trx2', date: '2025-04-02', mutable: false },
        ];
        (api.fetchTransactionsByAccount as jest.Mock).mockResolvedValue({
            data: mockTransactions,
            totalPages: 1,
        });
        (database.persistTransactions as jest.Mock).mockResolvedValue(undefined);

        await transactionRepository['fetchFromNetwork']('account1');

        expect(api.fetchTransactionsByAccount).toHaveBeenCalledWith('account1', 0, 200, expect.any(Object));
        expect(database.persistTransactions).toHaveBeenCalledWith(mockTransactions, 'account1');
        expect(transactionRepository['memoryCache'].size).toBe(2); // Verificar tamaño del Map
        expect(transactionRepository['memoryCache'].get('trx1')).toEqual(mockTransactions[0]); // Verificar contenido
    });

    it('should handle cancellation during fetch', async () => {
        const abortController = new AbortController();
        transactionRepository['abortController'] = abortController;

        abortController.abort();

        await expect(transactionRepository['fetchFromNetwork']('account1')).rejects.toThrow();
        expect(api.fetchTransactionsByAccount).not.toHaveBeenCalled();
    });

    it('should skip fetching additional pages if no mutable transactions are found', async () => {
        transactionRepository['memoryCache'].set('trx1', {
            id: 'trx1', date: '2025-04-01', mutable: false,
            description: '',
            amount: 0,
            currency: '',
            type: ''
        });
        transactionRepository['memoryCache'].set('trx2', {
            id: 'trx2', date: '2025-04-02', mutable: false,
            description: '',
            amount: 0,
            currency: '',
            type: ''
        });
        (database.getTransactionById as jest.Mock).mockResolvedValue({ id: 'trx1', date: '2025-04-01', mutable: false });

        await transactionRepository['fetchAdditionalPages']('trx1', 3, 'account1', new AbortController().signal);

        expect(api.fetchTransactionsByAccount).not.toHaveBeenCalled();
    });

    it('should clean old transactions and reset the cache', async () => {
        transactionRepository['memoryCache'].set('trx1', {
            id: 'trx1', date: '2025-04-01', mutable: false,
            description: '',
            amount: 0,
            currency: '',
            type: ''
        });
        transactionRepository['memoryCache'].set('trx2', {
            id: 'trx2', date: '2025-04-02', mutable: false,
            description: '',
            amount: 0,
            currency: '',
            type: ''
        });

        await transactionRepository.cleanOldTransactions();

        expect(database.cleanOldTransactions).toHaveBeenCalled();
        expect(transactionRepository['memoryCache'].size).toBe(0); // Verificar que el Map esté vacío
        expect(transactionRepository['lastUpdateTimestamp']).toBe(0);
    });

    it('should notify updates when transactions are fetched', async () => {
        const mockCallback = jest.fn();
        transactionRepository.onUpdate(mockCallback);

        transactionRepository['memoryCache'].set('trx1', {
            id: 'trx1', date: '2025-04-01', mutable: false,
            description: '',
            amount: 0,
            currency: '',
            type: ''
        });

        transactionRepository['notifyUpdates']();

        expect(mockCallback).toHaveBeenCalledWith(
            [{ id: 'trx1', date: '2025-04-01', mutable: false }], // Convertir valores del Map a array
            false
        );
    });
});
