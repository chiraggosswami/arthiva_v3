import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { couriers, customers, pincodes, products, seedOrders, type Order } from '../data/seed';
import { DEFAULT_ENGINE_CONFIG, evaluate, type EngineConfig } from '../engine';
import { SELLERS, DEFAULT_SELLER, type Seller } from '../data/sellers';

type State = {
  orders: Order[];
  engineConfig: EngineConfig;
  sellers: Seller[];
  currentSellerId: string;
  currentSeller: Seller;
  setCurrentSellerId: (id: string) => void;
  sellerOrders: Order[];
  addOrder: (o: Order) => void;
  event: (id: string, event: string) => void;
  updateOrder: (id: string, patch: Partial<Order>, timelineLabel?: string) => void;
  updateEngineConfig: (config: EngineConfig) => void;
};

const Ctx = createContext<State | null>(null);

export function AppState({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('arthiva-state') || localStorage.getItem('margin-pilot-state') || localStorage.getItem('naomi-state');
      return saved ? JSON.parse(saved) : seedOrders;
    } catch {
      return seedOrders;
    }
  });

  const [currentSellerId, setCurrentSellerIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('arthiva-current-seller') || localStorage.getItem('naomi-current-seller') || DEFAULT_SELLER.id;
    } catch {
      return DEFAULT_SELLER.id;
    }
  });

  const [engineConfig, setEngineConfig] = useState<EngineConfig>(() => {
    try {
      const saved = localStorage.getItem('arthiva-rules') || localStorage.getItem('margin-pilot-rules') || localStorage.getItem('naomi-rules');
      return saved ? JSON.parse(saved) : DEFAULT_ENGINE_CONFIG;
    } catch {
      return DEFAULT_ENGINE_CONFIG;
    }
  });

  const currentSeller = useMemo(() => {
    return SELLERS.find(s => s.id === currentSellerId) || DEFAULT_SELLER;
  }, [currentSellerId]);

  const setCurrentSellerId = (id: string) => {
    setCurrentSellerIdState(id);
    localStorage.setItem('arthiva-current-seller', id);
    localStorage.setItem('naomi-current-seller', id);
  };

  // Sync CSS variables whenever currentSeller changes
  useEffect(() => {
    if (!currentSeller) return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', currentSeller.accentColor.primary);
    root.style.setProperty('--brand-secondary', currentSeller.accentColor.secondary);
    root.style.setProperty('--brand-highlight', currentSeller.accentColor.highlight);
    root.style.setProperty('--brand-light-bg', currentSeller.accentColor.lightBg);
    root.style.setProperty('--brand-border', currentSeller.accentColor.border);
  }, [currentSeller]);

  useEffect(() => {
    if (!localStorage.getItem('arthiva-state')) {
      localStorage.setItem('arthiva-state', JSON.stringify(orders));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('arthiva-state', JSON.stringify(orders));
    localStorage.setItem('naomi-state', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('arthiva-rules', JSON.stringify(engineConfig));
    localStorage.setItem('naomi-rules', JSON.stringify(engineConfig));
  }, [engineConfig]);

  const addOrder = (o: Order) => setOrders(prev => [o, ...prev]);

  const recalculate = (updated: Order, config = engineConfig) => {
    const p = products.find(x => x.id === updated.productId) || products[0];
    const pin = pincodes.find(x => x.code === updated.pincode) || pincodes[0];
    const courier = couriers.find(x => x.id === updated.courierId) || couriers[0];
    const customer = customers.find(x => x.id === updated.customerId) || customers[0];
    const ev = evaluate(updated, p, pin, courier, customer, config);
    return { ...updated, score: ev.score, journey: ev.best.name };
  };

  const event = (id: string, label: string) => setOrders(prev => prev.map(o => {
    if (o.id !== id) return o;
    const updated = {
      ...o,
      addressVerified: o.addressVerified || label === 'Address verified',
      addressComplete: o.addressComplete || label === 'Address verified',
      otpPassed: o.otpPassed || label === 'OTP passed',
      advancePaid: o.advancePaid || label === 'Advance paid',
      status: label === 'NDR raised' ? 'NDR raised' : label === 'RTO initiated' ? 'RTO initiated' : label === 'Delivery attempted' ? 'Out for delivery' : label === 'Address verified' ? 'Address verified' : label === 'OTP passed' ? 'Confirmed' : o.status,
      timeline: [...o.timeline, { label, at: 'Just now' }]
    };
    return recalculate(updated);
  }));

  const updateOrder = (id: string, patch: Partial<Order>, timelineLabel?: string) => setOrders(prev => prev.map(o => {
    if (o.id !== id) return o;
    const updated = { ...o, ...patch, timeline: timelineLabel ? [...o.timeline, { label: timelineLabel, at: 'Just now' }] : o.timeline };
    return recalculate(updated);
  }));

  const updateEngineConfig = (config: EngineConfig) => {
    setEngineConfig(config);
    setOrders(current => current.map(o => recalculate(o, config)));
  };

  // sellerOrders: orders that belong to the active seller, or if active seller has fewer than 10, fallback gracefully
  const sellerOrders = useMemo(() => {
    const matched = orders.filter(o => o.sellerId === currentSellerId);
    return matched.length > 0 ? matched : orders;
  }, [orders, currentSellerId]);

  const value = useMemo(() => ({
    orders,
    engineConfig,
    sellers: SELLERS,
    currentSellerId,
    currentSeller,
    setCurrentSellerId,
    sellerOrders,
    addOrder,
    event,
    updateOrder,
    updateEngineConfig
  }), [orders, engineConfig, currentSellerId, currentSeller, sellerOrders]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const value = useContext(Ctx);
  if (!value) throw new Error('AppState provider missing');
  return value;
}
