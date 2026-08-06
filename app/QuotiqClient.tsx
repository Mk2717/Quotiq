'use client';

import { HashRouter } from 'react-router-dom';
import '../quotiq/lib/bootstrapWorkspace';
import RoutedApp from '../quotiq/components/RoutedApp';
import MobileOffline from '../quotiq/components/MobileOffline';

export default function QuotiqClient() {
  return (
    <HashRouter>
      <RoutedApp />
      <MobileOffline />
    </HashRouter>
  );
}
