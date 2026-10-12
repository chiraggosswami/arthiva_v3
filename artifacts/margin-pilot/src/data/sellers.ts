export type Seller = {
  id: string;
  name: string;
  category: string;
  tagline: string;
  accentColor: {
    primary: string;       // Main brand tone (e.g. sidebar, primary buttons)
    secondary: string;     // Support tone (icons, pills)
    highlight: string;     // High-energy accent (dots, badges, warnings)
    lightBg: string;       // Subtle tinted background for cards/chips
    border: string;        // Accent border
  };
  productIds: string[];
  sampleAov: number;
  monthlyOrders: number;
};

export const SELLERS: Seller[] = [
  {
    id: 'ojas-botanics',
    name: 'Ojas Botanics',
    category: 'Ayurvedic Skincare & Wellness',
    tagline: 'Clean Ayurvedic Formulations & Herbal Extracts',
    accentColor: {
      primary: '#0e3b43',
      secondary: '#1f8a5b',
      highlight: '#f5a524',
      lightBg: '#eaf5ef',
      border: '#9bbcaf'
    },
    productIds: ['P01', 'P02', 'P03', 'P05', 'P06', 'P07', 'P08'],
    sampleAov: 1840,
    monthlyOrders: 1420
  },
  {
    id: 'kavya-couture',
    name: 'Kavya Couture',
    category: 'Artisanal Ethnic & Festive Wear',
    tagline: 'Handloom Silks, Chanderi & Embroidered Anarkalis',
    accentColor: {
      primary: '#831843',
      secondary: '#be185d',
      highlight: '#f43f5e',
      lightBg: '#fdf2f8',
      border: '#f472b6'
    },
    productIds: ['KC01', 'KC02', 'KC03', 'KC04'],
    sampleAov: 4250,
    monthlyOrders: 890
  },
  {
    id: 'urban-stride',
    name: 'Urban Stride',
    category: 'Athleisure & Performance Streetwear',
    tagline: 'Technical Running Gear, Joggers & Activewear',
    accentColor: {
      primary: '#1e3a8a',
      secondary: '#2563eb',
      highlight: '#06b6d4',
      lightBg: '#eff6ff',
      border: '#93c5fd'
    },
    productIds: ['US01', 'US02', 'US03', 'US04'],
    sampleAov: 2490,
    monthlyOrders: 2180
  },
  {
    id: 'aura-living',
    name: 'Aura Living',
    category: 'Sustainable Home & Ceramic Decor',
    tagline: 'Hand-thrown Ceramics, Linen & Botanical Living',
    accentColor: {
      primary: '#9a3412',
      secondary: '#c2410c',
      highlight: '#d97706',
      lightBg: '#fff7ed',
      border: '#fdba74'
    },
    productIds: ['AL01', 'AL02', 'AL03', 'AL04'],
    sampleAov: 2150,
    monthlyOrders: 1140
  }
];

export const DEFAULT_SELLER = SELLERS[0];
