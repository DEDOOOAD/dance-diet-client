import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { name: 'index', label: '홈', icon: 'home', iconOut: 'home-outline' },
  { name: 'classes', label: '클래스', icon: 'play-circle', iconOut: 'play-circle-outline' },
  { name: 'food', label: '식단', icon: 'camera', iconOut: 'camera-outline' },
  { name: 'record', label: '기록', icon: 'bar-chart', iconOut: 'bar-chart-outline' },
  { name: 'profile', label: '프로필', icon: 'person', iconOut: 'person-outline' },
] as const;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((route) => TABS.some((tab) => tab.name === route.name));

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((item) => item.key === route.key);
        const tab = TABS.find((item) => item.name === route.name) ?? TABS[0];
        const focused = state.index === routeIndex;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.item}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.75}>
            {focused && <View style={styles.dot} />}
            <Ionicons
              name={(focused ? tab.icon : tab.iconOut) as keyof typeof Ionicons.glyphMap}
              size={22}
              color={focused ? colors.accent : colors.text3}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="classes" options={{ title: '클래스' }} />
      <Tabs.Screen name="food" options={{ title: '식단' }} />
      <Tabs.Screen name="record" options={{ title: '기록' }} />
      <Tabs.Screen name="profile" options={{ title: '프로필' }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -10,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.text3,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
});
