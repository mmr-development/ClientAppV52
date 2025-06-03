import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type BasketItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

type Notes = { [id: number]: string };

type BasketContextType = {
  basket: BasketItem[];
  setBasket: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  notes: Notes;
  setNotes: React.Dispatch<React.SetStateAction<Notes>>;
  clearBasket: () => void;
  partnerId?: number;
  setPartnerId: (id: number | undefined) => void;
};

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export const BasketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [notes, setNotes] = useState<Notes>({});
  const [partnerId, setPartnerId] = useState<number | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem('basket').then(data => {
      if (data) setBasket(JSON.parse(data));
    });
    AsyncStorage.getItem('notes').then(data => {
      if (data) setNotes(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('basket', JSON.stringify(basket));
  }, [basket]);
  useEffect(() => {
    AsyncStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  const clearBasket = () => {
    setBasket([]);
    setNotes({});
    AsyncStorage.removeItem('basket');
    AsyncStorage.removeItem('notes');
  };

  return (
    <BasketContext.Provider value={{ basket, setBasket, notes, setNotes, clearBasket, partnerId, setPartnerId }}>
      {children}
    </BasketContext.Provider>
  );
};

export const useBasket = () => {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasket must be used within a BasketProvider');
  return ctx;
};