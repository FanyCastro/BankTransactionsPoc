import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import database from './src/services/database';
import AccountsScreen from './src/screens/AccountsScreen';
import { RootStackParamList } from './src/types/types';
import TransactionsScreen from './src/screens/TransactionsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Inicializar la base de datos al arrancar la app
database.initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

const App: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Accounts">
        <Stack.Screen
          name="Accounts"
          component={AccountsScreen}
          options={{ title: 'Mis Cuentas' }}
        />
        <Stack.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ title: 'Transacciones' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
