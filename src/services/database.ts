import SQLite from 'react-native-sqlite-storage';
import { Transaction } from '../types/types';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

const DB_NAME = 'bank_transactions.db';
let db: SQLite.SQLiteDatabase;

interface Database {
  initDatabase: () => Promise<SQLite.SQLiteDatabase>;
  persistTransactions: (transactions: Transaction[], accountId: string) => Promise<void>;
  getTransactionsByAccountId: (accountId: string, searchTerm?: string) => Promise<Transaction[]>;
  getLastTransactionId: (accountId: string) => Promise<string | null>;
  getTransactionById: (transactionId: string) => Promise<Transaction | null>
  cleanOldTransactions: () => Promise<void>;
}


const initDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  try {
    db = await SQLite.openDatabase({
      name: DB_NAME,
      location: 'default',
    });

    await new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            balance REAL DEFAULT 0,
            currency TEXT NOT NULL
          );`,
          [],
          () => console.log('***** Tabla ACCOUNTS creada'),
          (_, error) => {
            console.error('Error creando accounts:', error);
            return false; // Hace rollback
          }
        );

        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            accountId TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            type TEXT,
            date TEXT NOT NULL,
            FOREIGN KEY (accountId) REFERENCES accounts(accountId)
          );`,
          [],
          () => console.log('***** Tabla TRANSACTIONS creada'),
          (_, error) => {
            console.error('Error creando transactions:', error);
            return false; // Hace rollback
          }
        );

        tx.executeSql(`
          CREATE INDEX IF NOT EXISTS idx_transactions_account 
          ON transactions(accountId);`,
          [],
          () => console.log('***** Índice creado'),
          (_, error) => {
            console.error('Error creando índice:', error);
            return false;
          }
        );
      },
      (error) => {
        console.error('Error en transacción:', error);
        reject(error);
      },
      () => {
        console.log('Transacción completada');
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT 1 FROM transactions LIMIT 1',
          [],
          (_, result) => {
            console.log('***** DB ready - Rows:', result.rows.length);
            resolve();
          },
          (_, error) => {
            console.error('Error verificando tabla:', error);
            reject(error);
            return false;
          }
        );
      });
    });

    return db;

  } catch (error) {
    console.error('Error inicializando DB:', error);
    throw error;
  }
};

const persistTransactions = async (transactions: Transaction[], accountId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    console.log('***** Save transactions into the local database');
    await new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        transactions.forEach(transaction => {
          tx.executeSql(
            `INSERT OR IGNORE INTO transactions (
              id, 
              accountId,
              description, 
              amount, 
              currency, 
              type, 
              date
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              transaction.id,
              accountId,
              transaction.description,
              transaction.amount,
              transaction.currency,
              transaction.type ,
              transaction.date,
            ],
            (_, result) => {
              console.log(`Transacción guardada con éxito. Affected rows ${result.rowsAffected}`);
              resolve();
            },
            (_, error) => {
              console.error('Error guardando transacción:', error);
              reject(error);
              return false;
            }
          );
        });
      });
    });

  } catch (error) {
    console.error('Error en saveTransaction:', error);
    throw error;
  }
};

const getTransactionsByAccountId = async (accountId: string): Promise<Transaction[]> => {
  console.log('***** Get all transcations by account from API');
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM transactions WHERE accountId = ? ORDER BY date DESC;',
        [accountId],
        (_, { rows }) => {
          const transactions: Transaction[] = [];
          for (let i = 0; i < rows.length; i++) {
            transactions.push(rows.item(i));
          }
          resolve(transactions);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

const getTransactionById = async (transactionId: string): Promise<Transaction | null> => {
  return new Promise<Transaction>((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT id FROM transactions WHERE id = ?;',
        [transactionId],
        (_, {rows}) => {
          resolve(rows.item(0)?.id ?? null);
        },
        (_, error) => {
          console.error(`***** Error getting last transaction ID: ${error.message}`);
          reject(new Error(`Error en consulta SQL: ${error.message}`));
          return false;
        }
      );
    });
  });
};

const getLastTransactionId = async (accountId: string): Promise<string | null> => {
  console.log('***** Get last transaction id from local Storage');
  return new Promise<string>((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT id FROM transactions WHERE accountId = ? ORDER BY date DESC LIMIT 1;',
        [accountId],
        (_, {rows}) => {
          console.log(`***** Last transaction id ${rows.item(0)?.id}`);
          resolve(rows.item(0)?.id ?? null);
        },
        (_, error) => {
          console.error(`***** Error getting last transaction ID: ${error.message}`);
          reject(new Error(`Error en consulta SQL: ${error.message}`));
          return false;
        }
      );
    });
  });
};

const cleanOldTransactions = async (): Promise<void> => {
  const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM transactions WHERE loadedAt < ?',
              [sixMonthsAgo],
        () => {
          console.log('Old transactions cleaned');
          resolve();
        },
        (_, error) => {
          console.error('Error cleaning transactions', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
//   if (!db) {
//     return await initDatabase();
//   }
//   return db;
// };

const database: Database = {
  initDatabase,
  persistTransactions,
  getTransactionsByAccountId,
  getLastTransactionId,
  getTransactionById,
  cleanOldTransactions,
};

export default database;
