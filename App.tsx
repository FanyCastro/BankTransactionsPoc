import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import database from './src/services/database';
import AccountsScreen from './src/screens/AccountsScreen';
import { RootStackParamList } from './src/types/types';
import TransactionsScreen from './src/screens/TransactionsScreen';
import MyWebComponent from './src/screens/MyWebComponent';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

database.initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

const linking = {
  prefixes: ['https://test-android-deeplinks.s3.eu-west-2.amazonaws.com'],
  config: {
    screens: {
      Accounts: {
        path: '/accounts',
        exact: true,
      },
      Transactions: {
        path: '/accounts/:accountId/transactions',
        exact: true,
        parse: {
          accountId: String,
        },
      },
    },
  },
};

const App: React.FC = () => {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
        <Stack.Screen name="Accounts" component={AccountsScreen} options={{ title: 'My Accounts' }} />
        <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'List of Transactions' }} />
        <Stack.Screen name="MyWebComponent" component={MyWebComponent} options={{ title: 'My Web Component' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
