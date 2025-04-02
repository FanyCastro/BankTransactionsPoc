const { faker } = require('@faker-js/faker');

const generateAccounts = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    accountId: `acct_${i+1}`,
    name: `${faker.finance.accountName()} Account`,
    balance: faker.finance.amount(100, 10000, 2),
    currency: 'GBP'
  }));
};

const generateTransactions = (accounts, perAccount) => {
  const allTransactions =  accounts.flatMap(account => 
    Array.from({ length: perAccount }, () => ({
      transactionId: faker.string.uuid(),
      accountId: account.accountId,
      description: faker.finance.transactionDescription(),
      amount: faker.finance.amount(-1000, 3000, 2),
      date: faker.date.recent(30).toISOString(),
      category: faker.helpers.arrayElement(['food', 'transport', 'shopping', 'income', 'transfer']),
      currency: 'GBP'
    }))
  );

  return {
    data: allTransactions,
    total: allTransactions.length,
    page: 1,
    size: 4,
  };
};

const data = {
  accounts: generateAccounts(5),
  transactions: generateTransactions(generateAccounts(5), 50)
};

console.log(JSON.stringify(data, null, 2));