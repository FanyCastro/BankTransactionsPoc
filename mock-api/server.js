const express = require('express');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Generate fake data file path
const DATA_FILE = path.join(__dirname, 'fakeData.json');

// Middleware to parse JSON bodies
app.use(express.json());

// Generate fake data if file doesn't exist
function generateFakeData() {
    if (fs.existsSync(DATA_FILE)) {
        return;
    }

    const accounts = [];

    // Generate 5-10 fake accounts
    const accountCount = faker.number.int({ min: 2, max: 5 });

    for (let i = 0; i < accountCount; i++) {
        const accountId = faker.string.uuid();
        const transactionCount = faker.number.int({ min: 10000, max: 15000 });
        const transactions = [];

        for (let j = 0; j < transactionCount; j++) {
            transactions.push({
                id: faker.string.uuid(),
                amount: faker.finance.amount(),
                type: faker.helpers.arrayElement(['deposit', 'withdrawal', 'transfer']),
                date: faker.date.recent().toISOString(),
                currency: faker.finance.currencyCode(),
                description: faker.finance.transactionDescription(),
            });
        }

        accounts.push({
            id: accountId,
            accountNumber: faker.finance.accountNumber(),
            accountName: faker.finance.accountName(),
            balance: faker.finance.amount(),
            currency: faker.finance.currencyCode(),
            transactions,
        });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify({ accounts }, null, 2));
}

// Load data from file
function loadData() {
    generateFakeData();
    const rawData = fs.readFileSync(DATA_FILE);
    return JSON.parse(rawData);
}


// Routes

function artificialDelay(delayMs) {
    return (req, res, next) => {
        setTimeout(next, delayMs);
    };
}

// GET all accounts
app.get('/accounts', (req, res) => {
    const data = loadData();

    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 10;
    if (page < 1 || size < 1) {
        return res.status(400).json({ error: 'Los parámetros page y size deben ser mayores a 0' });
    }
    const allAccounts = data.accounts.map(({ transactions, ...account }) => account);

    const startIndex = (page - 1) * size;
    const endIndex = page * size;

    const paginatedAccounts = allAccounts.slice(startIndex, endIndex);

    const response = {
        data: paginatedAccounts,
        total: allAccounts.length,
        page: page,
        size: size,
        totalPages: Math.ceil(allAccounts.length / size),
    };

    res.json(response);
});

// GET a specific account
app.get('/accounts/:accountId', artificialDelay(2000), (req, res) => {
    const data = loadData();
    const account = data.accounts.find(acc => acc.id === req.params.accountId);

    if (account) {
        const { transactions, ...accountDetails } = account;
        res.json(accountDetails);
    } else {
        res.status(404).json({ error: 'Account not found' });
    }
});

// GET all transactions for an account
app.get('/accounts/:accountId/transactions', artificialDelay(3000), (req, res) => {
    const data = loadData();
    const account = data.accounts.find(acc => acc.id === req.params.accountId);

    if (!account) {
        return res.status(404).json({ error: 'Account not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 10;
    if (page < 1 || size < 1) {
        return res.status(400).json({ error: 'Los parámetros page y size deben ser mayores a 0' });
    }

    const sortedTransactions = [...account.transactions].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    const startIndex = (page - 1) * size;
    const endIndex = page * size;

    const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

    const response = {
        data: paginatedTransactions,
        total: account.transactions.length,
        page: page,
        size: size,
        totalPages: Math.ceil(account.transactions.length / size),
        accountId: account.accountId,
        accountNumber: account.accountNumber,
    };

    res.json(response);
});

// GET a specific transaction for an account
app.get('/accounts/:accountId/transactions/:transactionId', artificialDelay(2000), (req, res) => {
    const data = loadData();
    const account = data.accounts.find(acc => acc.id === req.params.accountId);

    if (!account) {
        return res.status(404).json({ error: 'Account not found' });
    }

    const transaction = account.transactions.find(
        trans => trans.id === req.params.transactionId
    );

    if (transaction) {
        res.json(transaction);
    } else {
        res.status(404).json({ error: 'Transaction not found' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    generateFakeData(); // Ensure data is generated when server starts
});
