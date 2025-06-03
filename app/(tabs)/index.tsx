import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { SidebarButtonWithLogo } from '../../components/SidebarButton';
import * as api from '../../constants/API';
import { getPublicImageUrl } from '../../constants/API';
import translations from '../../constants/locales';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSidebar } from '../../hooks/useSidebar';
import { styles } from '../../styles';

const STORAGE_KEY = 'recent_addresses';
const PRIMARY_ADDRESS_KEY = 'primary_address';

const { height: screenHeight } = Dimensions.get('window');

export default function AddressAutocomplete() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [recent, setRecent] = useState<string[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [showRecent, setShowRecent] = useState(false);
  const t = (key: keyof typeof translations["da"]) =>
    (translations[language] as typeof translations["da"])[key];
  const { sidebarVisible, toggleSidebar, closeSidebar } = useSidebar();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [partnerHours, setPartnerHours] = useState<{ [partnerId: number]: any[] }>({});
  const [restaurantDetails, setRestaurantDetails] = useState<{ [id: number]: any }>({});

  const today = (new Date().getDay() + 6) % 7;

  useEffect(() => {
    AsyncStorage.getItem(PRIMARY_ADDRESS_KEY).then(addr => {
      if (addr) {
        setSelected(addr);
        setQuery('');
      }
    });
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) {
        const all = JSON.parse(data);
        setRecent(all.slice(0, 5));
      } 
    });
  }, []);

  useEffect(() => {
    const fetchHours = async () => {
      const hoursMap: { [partnerId: number]: any[] } = {};
      await Promise.all(
        restaurants.map(async (r: any) => {
          try {
            const data = await api.get(`partners/${r.id}/hours/`).then((res) => {
              if (res.status == 200){
                return res.data;
              }else {
                throw new Error('Failed to fetch hours');
              }
            });
            hoursMap[r.id] = data.hours;
          } catch {
            hoursMap[r.id] = [];
          }
        })
      );
      setPartnerHours(hoursMap);
    };
    if (restaurants.length > 0) fetchHours();
  }, [restaurants]);

  // Fetch extra details (min preparation time, min order value) for each restaurant
  useEffect(() => {
    if (!restaurants.length) {
      setRestaurantDetails({});
      return;
    }
    const fetchDetails = async () => {
      const details: { [id: number]: any } = {};
      await Promise.all(
        restaurants.map(async (r: any) => {
          try {
            const data = await api.get(`partners/${r.id}/`).then((res) => {
              if (res.status === 200) {
                return res.data;
              } else {
                throw new Error('Failed to fetch restaurant details');
              }
            });
            details[r.id] = {
              minPreparation: data.min_preparation_time_minutes,
              maxPreparation: data.max_preparation_time_minutes,
              minOrder: data.min_order_value,
            };
          } catch {
            // ignore errors
          }
        })
      );
      setRestaurantDetails(details);
    };
    fetchDetails();
  }, [restaurants]);

  const saveRecent = async (address: string) => {
    let allAddresses: string[] = [];
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) allAddresses = JSON.parse(stored);
    } catch {}
    allAddresses = [address, ...allAddresses.filter(a => a !== address)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allAddresses));
    setRecent(allAddresses.slice(0, 5));
  };

  const fetchSuggestions = async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      let data = await api.get(`address-autocomplete?q=${encodeURIComponent(text)}`).then((res) => {
        if (res.status === 200) {
          return res.data;
        } else {
          throw new Error('Failed to fetch suggestions');
        }
      });
      setSuggestions(data);
    } catch (e) {
      setSuggestions([]);
    }
  };

  const isValidAddress = (address: string) => {
    if (!address) return false;
    const parts = address.split(',');
    if (parts.length < 2) return false;
    const streetAndNumber = parts[0].trim();
    const cityAndZip = parts[1].trim();
    if (!/^\S.+\s+\d+.*$/.test(streetAndNumber)) return false;
    if (!/^\d{4}\s+\S+/.test(cityAndZip)) return false;
    return true;
  };

  const handleSelect = (item: any) => {
    const addressText = item?.tekst || query;
    if (!isValidAddress(addressText)) {
      setQuery(addressText);
      setSuggestions([]);
      fetchSuggestions(addressText);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    setSelected(addressText);
    setQuery(addressText);
    setSuggestions([]);
    saveRecent(addressText);
  };

  const handleRecentSelect = (address: string) => {
    if (!isValidAddress(address)) {
      setQuery(address);
      fetchSuggestions(address);
      setShowRecent(false);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    setSelected(address);
    setQuery('');
    AsyncStorage.setItem(PRIMARY_ADDRESS_KEY, address);
  };

  const handleRestaurantPress = (restaurant: any) => {
    router.push({
      pathname: '/menu',
      params: {
        partnerId: restaurant.id,
      },
    });
  };

  // Save the selected address to AsyncStorage
  useEffect(() => {
    if (!selected) {
      setRestaurants([]);
      return;
    }
    let city = '';
    const lastPart = selected.split(',').pop()?.trim() || '';
    const cityMatch = lastPart.match(/\d{4}\s*([A-Za-zæøåÆØÅ\- ]+)/);
    if (cityMatch && cityMatch[1]) {
      city = cityMatch[1].trim().split(' ')[0];
    } else {
      city = lastPart.split(' ')[1] || lastPart;
    }
    if (!city) return;
    setLoadingRestaurants(true);

    const url = `partners/?city=${encodeURIComponent(city)}`;
    console.log('Fetching restaurants for city:', city, 'URL:', url);

    api.get(url)
      .then(res => {
        console.log('API response:', res);
        return res.data;
      })
      .then(data => {
        console.log('Fetched data for city', city, ':', data);
        const filtered = (data.partners || []).filter(
          (p: any) => p.business_type?.name === 'Restaurant'
        );
        setRestaurants(filtered);
        const allCategories = filtered.map((r: any) => r.category?.name).filter(Boolean);
        setCategories(Array.from(new Set(allCategories)));
      })
      .catch((err) => {
        setRestaurants([]);
      })
      .finally(() => setLoadingRestaurants(false));
  }, [selected]);

  const getStreetAndNumber = (address: string) => {
    if (!address) return '';
    return address.split(',')[0];
  };

  const filteredRestaurants = selectedCategory
    ? restaurants.filter(r => r.category?.name === selectedCategory)
    : restaurants;

    // restaurant hours
  const isOpenNow = (hours: any[]) => {
    if (!hours) return false;
    const todayHours = hours.find(h => h.day_of_week === today);
    if (!todayHours) return false;
    const now = new Date();
    const [openH, openM] = todayHours.opens_at.split(':').map(Number);
    const [closeH, closeM] = todayHours.closes_at.split(':').map(Number);
    const openDate = new Date(now);
    openDate.setHours(openH, openM, 0, 0);
    const closeDate = new Date(now);
    closeDate.setHours(closeH, closeM, 0, 0);
    return now >= openDate && now <= closeDate;
  };

  const getTodayHoursString = (hours: any[]) => {
    if (!hours) return '';
    const todayHours = hours.find(h => h.day_of_week === today);
    if (!todayHours) return '—';
    return `${todayHours.opens_at.slice(0,5)} - ${todayHours.closes_at.slice(0,5)}`;
  };

  return (
    <>
      <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
      <SidebarButtonWithLogo onPress={toggleSidebar} />
      <SafeAreaView style={{ flex: 1, backgroundColor: styles.container.backgroundColor }}>
        <View style={styles.container}>
          <View style={styles.autocompleteContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={query}
              onChangeText={fetchSuggestions}
              placeholder={t('searchAddress')}
              onFocus={() => setShowRecent(true)}
              onBlur={() => setTimeout(() => setShowRecent(false), 150)}
            />
            {showRecent && !query && recent.length > 0 && (
              <View style={styles.suggestions}>
                {recent.map(addr => (
                  <TouchableOpacity
                    key={addr}
                    style={styles.suggestion}
                    onPress={() => {
                      handleRecentSelect(addr);
                      setShowRecent(false);
                    }}
                  >
                    <Text>{getStreetAndNumber(addr)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {suggestions.length > 0 && (
              <FlatList
                style={styles.suggestions}
                data={suggestions}
                keyExtractor={item => item.tekst}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => handleSelect(item)} style={styles.suggestion}>
                    <Text>{item.tekst}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
          {selected && (
            <View style={{ marginTop: 24, flex: 1 }}>
              {categories.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 2, minHeight: 48, maxHeight: 48 }}
                  >
                    {['All', ...categories].map(item => {
                      const isSelected =
                        (item === 'All' && !selectedCategory) ||
                        (item !== 'All' && selectedCategory === item);
                      return (
                        <React.Fragment key={item}>
                          <TouchableOpacity
                            key={item}
                            onPress={() =>
                              item === 'All'
                                ? setSelectedCategory(null)
                                : setSelectedCategory(item)
                            }
                            style={[
                              styles.categoryButton,
                              isSelected && styles.categoryButtonActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryButtonText,
                                isSelected && styles.categoryButtonTextActive,
                              ]}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        </React.Fragment>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {loadingRestaurants ? (
                <ActivityIndicator size="large" color={styles.addressHistoryText.color} />
              ) : filteredRestaurants.length === 0 ? (
                <Text>{t('noSavedAddresses')}</Text>
              ) : (
                <FlatList
                  data={filteredRestaurants}
                  keyExtractor={item => item.id.toString()}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 90 }}
                  renderItem={({ item }) => {
                    const hours = partnerHours[item.id];
                    const open = isOpenNow(hours);
                    const details = restaurantDetails[item.id] || {};
                    return (
                      <TouchableOpacity
                        style={[
                          styles.restaurantCard,
                          !open && { opacity: 0.5 }
                        ]}
                        onPress={() => handleRestaurantPress(item)}
                      >
                        <View style={styles.restaurantCardRow}>
                          {item.logo_url ? (
                            <View style={styles.restaurantLogoWrapper}>
                              <Image
                                source={{ uri: getPublicImageUrl(item.logo_url) }}
                                style={styles.restaurantLogoImage}
                                resizeMode="contain"
                              />
                            </View>
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.restaurantName}>{item.name}</Text>
                            <Text style={styles.restaurantAddress}>
                              {item.address.street} {item.address.address_detail}, {item.address.city}
                            </Text>
                            <Text style={{ color: open ? 'green' : 'gray', marginTop: 2 }}>
                              {getTodayHoursString(hours)}
                            </Text>
                            {(details.minPreparation !== undefined || details.maxPreparation !== undefined) && (
                              <Text style={styles.restaurantAddress}>
                                {t('prepTime') || 'Prep time'}{' '}
                                {details.minPreparation !== undefined && details.maxPreparation !== undefined
                                  ? `${details.minPreparation}-${details.maxPreparation} ${t('minutes') || 'minutes'}`
                                  : details.minPreparation !== undefined
                                  ? `${details.minPreparation} ${t('minutes') || 'minutes'}`
                                  : ''}
                              </Text>
                            )}
                            {details.minOrder !== undefined && (
                              <Text style={styles.restaurantAddress}>
                                {t('minOrderValue') || 'Min. order:'} {details.minOrder} kr
                              </Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          )}
          
        </View>
      </SafeAreaView>
    </>
  );
}