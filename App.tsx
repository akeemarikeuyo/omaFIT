import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LaunchScreen } from './src/components/LaunchScreen';
import { RootStackParamList, TabParamList } from './src/navigation';
import { getSettings } from './src/storage/store';
import CoachScreen from './src/screens/CoachScreen';
import ExerciseScreen from './src/screens/ExerciseScreen';
import PlanBuilderScreen from './src/screens/PlanBuilderScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SessionScreen from './src/screens/SessionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TodayScreen from './src/screens/TodayScreen';
import { colors } from './src/theme';

// Keep the native splash up until our own logo screen has drawn, so there's no flash between them
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Long enough to read as a launch screen, short enough not to slow anyone down. */
const MIN_LAUNCH_MS = 1200;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Review" component={ReviewScreen} />
      <Tab.Screen name="Coach" component={CoachScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showLaunch, setShowLaunch] = useState(true);

  useEffect(() => {
    let alive = true;
    // Warm up storage while the logo shows, then reveal the app
    Promise.all([getSettings().catch(() => null), new Promise(r => setTimeout(r, MIN_LAUNCH_MS))]).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onLaunchLayout = useCallback(() => SplashScreen.hide(), []);
  const onLaunchHidden = useCallback(() => setShowLaunch(false), []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Session" component={SessionScreen} />
          <Stack.Screen name="Exercise" component={ExerciseScreen} />
          <Stack.Screen name="PlanBuilder" component={PlanBuilderScreen} options={{ title: 'Build my plan' }} />
        </Stack.Navigator>
      </NavigationContainer>
      {showLaunch && <LaunchScreen visible={!ready} onLayout={onLaunchLayout} onHidden={onLaunchHidden} />}
    </SafeAreaProvider>
  );
}
