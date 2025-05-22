import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import translations from '../constants/locales';
import { styles } from '../styles';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.7;

type SidebarProps = {
  isVisible: boolean;
  onClose: () => void;
  language: 'da' | 'en';
};

export function Sidebar({ isVisible, onClose, language }: SidebarProps) {
  const slideAnim = useRef(new Animated.Value(isVisible ? 0 : -SIDEBAR_WIDTH)).current;

  useEffect(() => {
    const toValue = isVisible ? 0 : -SIDEBAR_WIDTH;
    Animated.timing(slideAnim, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isVisible, slideAnim]);

  const handlePageNavigation = (path: string) => {
    router.push(path as any);
    onClose(); // Collapse the sidebar when navigating to a page
  };

  const t = (key: keyof typeof translations["da"]) => {
    const dict = translations[language] as typeof translations["da"];
    return dict[key];
  };

  return (
    <>
      {isVisible && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        />
      )}

      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        {/* Logo centered at the top */}
        <View style={styles.sidebarLogoContainer}>
          <Image
            source={require('../assets/images/yourmom.png')}
            style={styles.sidebarLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>{t('navigation') || "Navigation"}</Text>
          <TouchableOpacity 
            style={{ position: 'absolute', right: 0, padding: 5 }} 
            onPress={onClose}
          >
            <Ionicons name="arrow-back" size={24} color="#1B5E20" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sidebarLinks}>
          <TouchableOpacity style={styles.sidebarLink} onPress={() => handlePageNavigation('/')}>
            <Ionicons name="home" size={24} color="#1B5E20" />
            <Text style={styles.sidebarLinkText}>{t('home') || "Home"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.sidebarLink} onPress={() => handlePageNavigation('/orders')}>
            <Ionicons name="document-text" size={24} color="#1B5E20" />
            <Text style={styles.sidebarLinkText}>{t('orders') || "Orders"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.sidebarLink} onPress={() => handlePageNavigation('/profile')}>
            <Ionicons name="person" size={24} color="#1B5E20" />
            <Text style={styles.sidebarLinkText}>{t('profile') || "Profile"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </>
  );
}