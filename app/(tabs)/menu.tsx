import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { SidebarButtonWithLogo } from '../../components/SidebarButton';
import * as api from '../../constants/API';
import translations from '../../constants/locales';
import { useBasket } from '../../contexts/BasketContext';
import { useLanguage } from '../../contexts/LanguageContext'; // adjust path as needed
import { useSidebar } from '../../hooks/useSidebar';
import { styles } from '../../styles';

const CategoryItem = React.memo(
  ({
    category,
    onAddToBasket,
    lastAddedId,
    basket,
  }: {
    category: any;
    onAddToBasket: (item: any) => void;
    lastAddedId: number | null;
    basket: any[];
  }) => {
    // Add state for expanded image modal
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [checkAnim] = React.useState(() => new Animated.Value(0));
    const [localCount, setLocalCount] = React.useState(0);
    const [animatingId, setAnimatingId] = React.useState<number | null>(null);

    React.useEffect(() => {
      if (lastAddedId && category.items.some((p: any) => p.id === lastAddedId)) {
        setAnimatingId(lastAddedId);
        setLocalCount((prev) => prev + 1);
        Animated.sequence([
          Animated.timing(checkAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(checkAnim, {
            toValue: 0,
            duration: 180,
            delay: 340,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setLocalCount(0);
          setAnimatingId(null);
        });
      }
    }, [lastAddedId]);

    return (
      <View style={{ marginBottom: 24 }}>
        <Text style={styles.label}>
          {category.catalogName}
        </Text>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          {category.name}
        </Text>
        {category.items && category.items.length > 0 ? (
          category.items.map((product: any) => {
            const basketCount = basket.find((i: any) => i.id === product.id)?.quantity || 0;
            const hasImage = product.image_url && product.image_url.trim() !== '';
            const imageSource = hasImage
              ? { uri: api.baseurl + 'public' + (product.image_url) }
              : require('../../assets/images/default.png'); // Adjust path if needed

            return (
              <TouchableOpacity
                key={product.id}
                style={styles.menuProductTouchable}
                onPress={() => onAddToBasket(product)}
                activeOpacity={0.7}
              >
                {/* Product Image */}
                <TouchableOpacity
                  onPress={e => {
                    e.stopPropagation?.();
                    if (hasImage) setExpandedImage(api.baseurl + 'public' + (product.image_url));
                  }}
                  activeOpacity={hasImage ? 0.8 : 1}
                  style={styles.menuProductImageWrapper}
                >
                  <Image
                    source={imageSource}
                    style={styles.menuProductImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuProductName}>{product.name}</Text>
                  {product.description ? (
                    <Text style={styles.menuProductDescription}>{product.description}</Text>
                  ) : null}
                  {product.price ? (
                    <Text style={styles.menuProductPrice}>
                      {product.price} kr
                    </Text>
                  ) : null}
                </View>
                {/* Reserve space for counter always */}
                <View style={styles.menuProductCounter}>
                  {basketCount > 0 ? (
                    <Text style={styles.menuProductCounterText}>
                      {basketCount}
                    </Text>
                  ) : (
                    // Empty space to reserve the layout
                    <View style={{ width: 24, height: 24 }} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={{ color: '#888' }}>No products in this category.</Text>
        )}

        {/* Expanded Image Modal */}
        <Modal
          visible={!!expandedImage}
          transparent
          animationType="fade"
          onRequestClose={() => setExpandedImage(null)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.85)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            activeOpacity={1}
            onPress={() => setExpandedImage(null)}
          >
            <Image
              source={expandedImage ? { uri: expandedImage } : undefined}
              style={{
                width: '90%',
                height: '60%',
                resizeMode: 'contain',
                borderRadius: 12,
                backgroundColor: '#fff',
              }}
            />
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }
);

export default function MenuScreen() {
  const { partnerId: routePartnerId } = useLocalSearchParams();
  const { setPartnerId } = useBasket();

  useEffect(() => {
    if (routePartnerId) {
      setPartnerId(Number(routePartnerId));
    }
  }, [routePartnerId, setPartnerId]);

  const { partnerId } = useLocalSearchParams();
  const prevPartnerId = useRef<string | number>(Array.isArray(partnerId) ? partnerId[0] : partnerId);
  const { sidebarVisible, toggleSidebar, closeSidebar } = useSidebar();
  const [catalog, setCatalog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Real basket state
  const { basket, setBasket, notes, setNotes, clearBasket } = useBasket();
  const [basketModalVisible, setBasketModalVisible] = useState(false);
  const [noteItemId, setNoteItemId] = useState<number | null>(null);
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const [minOrderValue, setMinOrderValue] = useState<number | null>(null);
  const router = useRouter();

  // Handle Android hardware back button to go to index instead of closing app
  useEffect(() => {
    const onBackPress = () => {
      router.replace('/'); // Go back to index.tsx
      return true; // Prevent default behavior (closing the app)
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [router]);

  // Only clear basket/notes if switching to a different restaurant
  useEffect(() => {
    const checkAndClearBasket = async () => {
      const lastPartnerId = await AsyncStorage.getItem('lastPartnerId');
      const currentPartnerId = Array.isArray(partnerId) ? partnerId[0] : partnerId;
      console.log('MenuScreen mount:');
      console.log('  lastPartnerId:', lastPartnerId);
      console.log('  currentPartnerId:', currentPartnerId);

      // Only clear if both IDs are defined and different
      if (
        lastPartnerId !== null &&
        lastPartnerId !== String(currentPartnerId) &&
        currentPartnerId !== undefined &&
        currentPartnerId !== null
      ) {
        console.log('Clearing basket because partnerId changed');
        setBasket([]);
        setNotes({});
        await AsyncStorage.removeItem('basket');
        await AsyncStorage.removeItem('notes');
      }

      // Only set lastPartnerId if currentPartnerId is defined
      if (currentPartnerId !== undefined && currentPartnerId !== null) {
        await AsyncStorage.setItem('lastPartnerId', String(currentPartnerId));
        prevPartnerId.current = currentPartnerId;
      }
    };
    checkAndClearBasket();
  }, [partnerId]);

  const handleAddToBasket = (item: any) => {
    setBasket(prev => {
      const existing = prev.find((i: any) => i.id === item.id);
      if (existing) {
        return prev.map((i: any) =>
          i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setLastAddedId(item.id);
    // No need to reset lastAddedId here, animation handles it
  };

  const totalCount = basket.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalValue = basket.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  const renderItem = useCallback(
    ({ item }: { item: any }) =>
      <CategoryItem
        category={item}
        onAddToBasket={handleAddToBasket}
        lastAddedId={lastAddedId}
        basket={basket}
      />,
    [handleAddToBasket, lastAddedId, basket]
  );

  const { language, setLanguage } = useLanguage();
  const t = (key: keyof typeof translations["da"]) => (translations[language] as Record<string, string>)[key];

  useEffect(async () => {
    if (!partnerId) return;
    setLoading(true);
    setSelectedCategoryId(null);
    let data = await api.get(`partners/${partnerId}/catalogs/full/?partner_id=${partnerId}`).then((res) => {
      if (res.status === 200) {
        return res.data;
      } else {
        throw new Error(`Failed to fetch catalog: ${res.statusText}`);
      }
    })

    setCatalog(data);
    // Try to get min_order_value from partner
    if (data?.partner?.min_order_value !== undefined) {
      setMinOrderValue(Number(data.partner.min_order_value));
    } else {
      setMinOrderValue(null);
    }
    setLoading(false);
    setNoteItemId(null);
  }, [partnerId]);

  // Add note handler
  const handleNoteChange = (id: number, text: string) => {
    setNotes(prev => ({ ...prev, [id]: text }));
  };

  const handleCloseBasketModal = () => {
    setBasketModalVisible(false);
    setNoteItemId(null); // Save and close any open note input
  };

  // Calculate how much is missing to reach min order value
  const missingAmount = minOrderValue !== null && totalValue < minOrderValue
    ? minOrderValue - totalValue
    : 0;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2cb673" />
      </View>
    );
  }

  if (!catalog || !catalog.catalogs || catalog.catalogs.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>No menu found for this restaurant.</Text>
      </View>
    );
  }

  // Extract unique categories from catalog data
  const allCategories = catalog.catalogs.flatMap((c: any) => c.categories || []);
  const uniqueCategories = allCategories.reduce((acc: any[], cat: any) => {
    if (!acc.some((c) => c.id === cat.id)) {
      acc.push({ id: cat.id, name: cat.name });
    }
    return acc;
  }, []);

  // Filter categories based on selectedCategoryId
  const filteredCategories = selectedCategoryId
    ? allCategories.filter((cat: any) => cat.id === selectedCategoryId)
    : allCategories;

  return (
    <>
      <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
      <SidebarButtonWithLogo onPress={toggleSidebar} />
      <View style={[styles.container, { flex: 1 }]}>
        {/* Title */}
        <View style={{ marginBottom: 0 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginRight: 12 }}>
            {catalog.partner?.name || 'Menu'}
          </Text>
        </View>
        {/* Horizontal category scrollbar directly under the title */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4, paddingLeft: 2, paddingRight: 2 }}
          style={{ marginBottom: 8 }}
        >
          {uniqueCategories.map((cat: { id: number; name: string }) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() =>
                setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)
              }
              style={[
                styles.categoryButton,
                selectedCategoryId === cat.id && styles.categoryButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategoryId === cat.id && styles.categoryButtonTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Category list */}
        <FlatList
          data={filteredCategories}
          keyExtractor={cat => cat.id?.toString() || cat.name}
          renderItem={renderItem}
          initialNumToRender={5}
          maxToRenderPerBatch={7}
          windowSize={10}
          contentContainerStyle={{ paddingBottom: 120 }} // Make sure this is >= basket bar height
        />
      </View>
      {/* Basket Bar OUTSIDE the main flex container */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderColor: '#b1e2c6',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 18,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          zIndex: 100, // ensure it's above other content
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 40 }}>
          <MaterialCommunityIcons name="basket" size={22} color="#2cb673" style={{ marginRight: 4 }} />
          <Text style={{ fontWeight: 'bold', color: '#2cb673', fontSize: 16 }}>
            {totalCount}
          </Text>
        </View>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setBasketModalVisible(true)}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#1B5E20', textAlign: 'center' }}>
            {t('viewBasket') || "View basket"}
          </Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: 'bold', color: '#2cb673', minWidth: 60, textAlign: 'right' }}>
          {totalValue} kr
        </Text>
      </View>
      {/* Basket Modal */}
      <Modal
        visible={basketModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBasketModalVisible(false)}
      >
        <View style={styles.basketModalOverlay}>
          {/* Overlay to close modal when pressing outside */}
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, zIndex: 1 }}
            activeOpacity={1}
            onPress={handleCloseBasketModal}
          />
          {/* Modal content with higher zIndex */}
          <View style={[styles.basketModalContent, { zIndex: 2, elevation: 2 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.basketModalTitle}>{t('yourBasket') || "Your Basket"}</Text>
              <Text style={{ fontWeight: 'bold', color: '#2cb673', fontSize: 16 }}>
                {t('total') || "Total"}: {totalValue} kr
              </Text>
            </View>
            {/* --- Show missing amount if below min order value --- */}
            {minOrderValue !== null && missingAmount > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: '#d32f2f', fontWeight: 'bold', textAlign: 'center' }}>
                  {/* Use hardcoded fallback if translation keys are missing */}
                  Min. order: {minOrderValue} kr. You need {missingAmount} kr more to order.
                </Text>
              </View>
            )}
            {/* Make basket scrollable */}
            <View style={{ maxHeight: 320, flexGrow: 1 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {basket.length === 0 ? (
                  <Text style={{ color: '#888', textAlign: 'center', marginVertical: 24 }}>
                    {t('basketEmpty') || "Basket is empty."}
                  </Text>
                ) : (
                  basket.map(item => (
                    <View key={item.id} style={styles.basketModalItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.basketModalItemName}>
                            {item.name} x{item.quantity || 1}
                          </Text>
                          <Text style={styles.basketModalItemPrice}>{item.price * (item.quantity || 1)} kr</Text>
                          {notes[item.id] && noteItemId !== item.id && (
                            <Text style={styles.basketModalNotePreview}>
                              {t('note') || "Note"}: {notes[item.id]}
                            </Text>
                          )}
                        </View>
                        {/* Small Note Icon Button */}
                        <TouchableOpacity
                          style={styles.basketModalNoteIconButton}
                          onPress={() => setNoteItemId(noteItemId === item.id ? null : item.id)}
                          accessibilityLabel={t('addNote') || "Note"}
                        >
                          <MaterialCommunityIcons
                            name={notes[item.id] ? "note-edit" : "note-plus-outline"}
                            size={20}
                            color={notes[item.id] ? "#2cb673" : "#888"}
                          />
                        </TouchableOpacity>
                        {/* Delete Button */}
                        <TouchableOpacity
                          style={styles.basketRemoveButton}
                          onPress={() => {
                            setBasket(prev => prev.filter(i => i.id !== item.id));
                            setNotes(prev => {
                              const newNotes = { ...prev };
                              delete newNotes[item.id];
                              return newNotes;
                            });
                            if (noteItemId === item.id) setNoteItemId(null);
                          }}
                        >
                          <Text style={styles.basketRemoveButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      {/* Note Input */}
                      {noteItemId === item.id && (
                        <View style={styles.basketModalNoteInputWrapper}>
                          <TextInput
                            style={styles.basketModalNoteInput}
                            placeholder={t('addNote') || "Add note..."}
                            value={notes[item.id] || ''}
                            onChangeText={text => handleNoteChange(item.id, text.slice(0, 20))}
                            multiline
                            maxLength={20}
                            blurOnSubmit={true}
                            returnKeyType="done"
                            onSubmitEditing={() => setNoteItemId(null)}
                          />
                          <TouchableOpacity
                            style={styles.basketModalNoteSaveButton}
                            onPress={() => setNoteItemId(null)}
                          >
                            <Text style={styles.basketModalNoteSaveButtonText}>{t('save') || "Save"}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
            <View style={styles.basketModalButtons}>
              <TouchableOpacity
                style={[styles.basketModalButton, styles.basketModalButtonSecondary]}
                onPress={handleCloseBasketModal}
              >
                <Text style={styles.basketModalButtonSecondaryText}>{t('continueOrdering') || "Continue Ordering"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.basketModalButton,
                  (basket.length === 0 || (minOrderValue !== null && totalValue < minOrderValue)) && { opacity: 0.5 }
                ]}
                onPress={() => {
                  if (basket.length === 0) return;
                  if (minOrderValue !== null && totalValue < minOrderValue) {
                    Alert.alert(
                      'Min. order',
                      `You need to order for at least ${minOrderValue} kr. You need ${missingAmount} kr more to order.`
                    );
                    return;
                  }
                  handleCloseBasketModal();
                  router.push('/(tabs)/checkout');
                }}
                disabled={basket.length === 0 || (minOrderValue !== null && totalValue < minOrderValue)}
              >
                <Text style={styles.basketModalButtonText}>{t('goToCheckout') || "Go to Checkout"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}