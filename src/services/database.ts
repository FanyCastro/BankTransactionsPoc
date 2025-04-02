import SQLite from 'react-native-sqlite-storage';
import { Transaction } from '../types/types';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

const DB_NAME = 'bank_transactions.db';
let db: SQLite.SQLiteDatabase;

interface Database {
  initDatabase: () => Promise<SQLite.SQLiteDatabase>;
  saveTransactions: (transactions: Transaction[]) => Promise<void>;
  getTransactionsByAccountId: (accountId: string, searchTerm?: string) => Promise<Transaction[]>;
  getLastTransactionId: (accountId: string) => Promise<string | null>;
  getAllTransactions: () => Promise<Transaction[] | null>;
}

// const deleteDatabase = async (): Promise<void> => {
//   try {
//     if (db) {
//       try {
//         await db.close();
//       } catch (closeError) {
//         console.warn('Error cerrando la conexión:', closeError);
//       }
//     }

//     await SQLite.deleteDatabase({
//       name: DB_NAME,
//       location: 'default',
//     });
//     console.log('Base de datos eliminada exitosamente');

//   } catch (error) {
//     console.error('Error eliminando la base de datos:', {
//       message: error instanceof Error ? error.message : 'Error desconocido',
//       stack: error instanceof Error ? error.stack : undefined,
//     });
//     throw new Error('No se pudo eliminar la base de datos');
//   }
// };


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
            accountId TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            balance REAL DEFAULT 0,
            currency TEXT NOT NULL
          );`,
          [],
          () => console.log('Tabla ACCOUNTS creada'),
          (_, error) => {
            console.error('Error creando accounts:', error);
            return false; // Hace rollback
          }
        );

        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS transactions (
            transactionId TEXT PRIMARY KEY,
            accountId TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            category TEXT,
            date TEXT NOT NULL,
            FOREIGN KEY (accountId) REFERENCES accounts(accountId)
          );`,
          [],
          () => console.log('Tabla TRANSACTIONS creada'),
          (_, error) => {
            console.error('Error creando transactions:', error);
            return false; // Hace rollback
          }
        );

        tx.executeSql(`
          CREATE INDEX IF NOT EXISTS idx_transactions_account 
          ON transactions(accountId);`,
          [],
          () => console.log('Índice creado'),
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
            console.log('DB ready - Rows:', result.rows.length);
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

export const saveTransactions = async (transactions: Transaction[]): Promise<void> => {

};



const getTransactionsByAccountId = async (accountId: string): Promise<Transaction[]> => {

};

const getLastTransactionId = async (accountId: string): Promise<string | null> => {
  return new Promise<string>((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT transactionId FROM transactions WHERE accountId = ? LIMIT 1;',
        [accountId],
        (_, results) => {
          const transactions = results.rows.raw();
          resolve(transactions[0]?.transactionId ?? null);
        },
        (_, error) => {
          reject(new Error(`Error en consulta SQL: ${error.message}`));
          return false;
        }
      );
    });
  });

};

const getAllTransactions = async(): Promise<Transaction[] | null> => {

};

const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    return await initDatabase();
  }
  return db;
};

const database: Database = {
  initDatabase,
  saveTransactions,
  getTransactionsByAccountId,
  getLastTransactionId,
  getAllTransactions,
};

export default database;
