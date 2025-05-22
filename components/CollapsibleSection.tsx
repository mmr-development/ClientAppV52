import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Text, TouchableOpacity, UIManager, View } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  title: string;
  children: React.ReactNode;
  initiallyOpen?: boolean;
  style?: any;
};

export const CollapsibleSection: React.FC<Props> = ({ title, children, initiallyOpen = true, style }) => {
  const [open, setOpen] = useState(initiallyOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={[{ marginBottom: 18 }, style]}>
      <TouchableOpacity
        onPress={toggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          paddingHorizontal: 4,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontWeight: 'bold', fontSize: 17 }}>{title}</Text>
        <FontAwesome name={open ? "chevron-down" : "chevron-right"} size={18} color="#888" />
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 6 }}>
          {children}
        </View>
      )}
    </View>
  );
};