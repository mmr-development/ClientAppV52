import { useState } from 'react';

export function useSidebar() {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };
  
  const closeSidebar = () => {
    setSidebarVisible(false);
  };
  
  return {
    sidebarVisible,
    toggleSidebar,
    closeSidebar
  };
}