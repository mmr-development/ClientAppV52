import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { colors, styles } from '../styles';

type Props = {
  onPress: () => void;
};

export function SidebarButtonWithLogo({ onPress }: Props) {
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 16,
        paddingHorizontal: 18,
        backgroundColor: colors.background,
        position: 'relative',
        minHeight: 60,
      }}
    >
      <TouchableOpacity
        style={[
          styles.sidebarButton,
          { position: 'relative', top: 0, left: 0, marginRight: 16, zIndex: 2 },
        ]}
        onPress={onPress}
      >
        <Ionicons name="menu" size={28} color={styles.sidebarButtonText.color} />
      </TouchableOpacity>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 32,
          alignItems: 'center',
          zIndex: 1,
        }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => router.push('/')}
          activeOpacity={0.7}
          style={{}}
        >
          <Image
            source={require('../assets/images/yourmom.png')}
            style={{ width: 120, height: 44, resizeMode: 'contain' }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}