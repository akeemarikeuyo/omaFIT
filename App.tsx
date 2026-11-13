import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LaunchScreen } from './src/components/LaunchScreen';
import { RootStackParamList, TabParamList } from './src/navigation';
import { offerRestAlertsOnce } from './src/session/restAlert';
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

type IconName = keyof typeof Ionicons.glyphMap;

/** Tab icons: filled when selected, outline otherwise. */
const TAB_ICONS: Record<keyof TabParamList, [IconName, IconName]> = {
  Today: ['today', 'today-outline'],
  Progress: ['stats-chart', 'stats-chart-outline'],
  Review: ['sparkles', 'sparkles-outline'],
  Coach: ['chatbubbles', 'chatbubbles-outline'],
  Settings: ['settings', 'settings-outline'],
};

/** The selected tab's icon sits on a soft gold pill, like a native nav bar. */
function TabIcon({ route, focused, color }: { route: keyof TabParamList; focused: boolean; color: string }) {
  const [filled, outline] = TAB_ICONS[route];
  return (
    <View
      style={{
        width: 56,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.accentSoft : 'transparent',
      }}
    >
      <Ionicons name={focused ? filled : outline} size={21} color={color} />
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ focused, color }) => <TabIcon route={route.name} focused={focused} color={color} />,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 6 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
        },
      })}
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

  // Once the launch screen is gone, ask (only ever once) whether to turn on the rest-over alert
  useEffect(() => {
    if (!showLaunch) void offerRestAlertsOnce();
  }, [showLaunch]);

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
