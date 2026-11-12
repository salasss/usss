import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/navigation/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Notre espace' }} />
      <Tabs.Screen name="bulle" options={{ title: 'Bulle' }} />
      <Tabs.Screen name="souvenirs" options={{ title: 'Souvenirs' }} />
    </Tabs>
  );
}
