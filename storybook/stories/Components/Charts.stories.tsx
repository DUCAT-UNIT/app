import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, G } from 'react-native-svg';
import type { Meta, StoryObj } from '@storybook/react';
import { COLORS } from '../../../theme';
import Icon from '../../../components/icons';
import { formatUnitAmount, formatBalance } from '../../../utils/formatters';

// Real components
import type { VaultHistoryTransaction } from '../../../services/vaultService';

// ============================================================================
// DEVICE SIZE CONFIG
// chartWidth = device width - 32px padding (16px each side)
// ============================================================================
const DEVICE_SIZES = {
  XS: { width: 320, chartWidth: 288, label: 'XS', subtitle: 'iPhone 5', iconSize: 28, fontSize: 11, dateFontSize: 10, padding: 12, minWidth: 70, chipFontSize: 9, chipPaddingH: 5, chipPaddingV: 2, chipMinWidth: 60, amountFontSize: 11, amountIconSize: 9 },
  S: { width: 375, chartWidth: 343, label: 'S', subtitle: 'iPhone SE/8', iconSize: 32, fontSize: 12, dateFontSize: 11, padding: 14, minWidth: 80, chipFontSize: 11, chipPaddingH: 6, chipPaddingV: 3, chipMinWidth: 70, amountFontSize: 12, amountIconSize: 10 },
  M: { width: 390, chartWidth: 358, label: 'M', subtitle: 'iPhone 12/13/14', iconSize: 36, fontSize: 14, dateFontSize: 12, padding: 16, minWidth: 85, chipFontSize: 12, chipPaddingH: 8, chipPaddingV: 4, chipMinWidth: 80, amountFontSize: 14, amountIconSize: 12 },
  L: { width: 393, chartWidth: 361, label: 'L', subtitle: 'iPhone 14 Pro', iconSize: 38, fontSize: 14, dateFontSize: 12, padding: 16, minWidth: 88, chipFontSize: 13, chipPaddingH: 8, chipPaddingV: 4, chipMinWidth: 82, amountFontSize: 14, amountIconSize: 12 },
  XL: { width: 430, chartWidth: 398, label: 'XL', subtitle: 'iPhone 16 Pro Max', iconSize: 40, fontSize: 15, dateFontSize: 12, padding: 18, minWidth: 95, chipFontSize: 14, chipPaddingH: 10, chipPaddingV: 5, chipMinWidth: 90, amountFontSize: 15, amountIconSize: 13 },
};

type DeviceSize = keyof typeof DEVICE_SIZES;
type DeviceConfig = typeof DEVICE_SIZES[DeviceSize];

// ============================================================================
// SCALED VAULT TRANSACTION ITEM (matching AssetTransactions.stories.tsx)
// ============================================================================
const formatVaultAction = (action: string): string => {
  const actionMap: Record<string, string> = {
    'open': 'Open Vault',
    'borrow': 'Borrow',
    'repay': 'Repay',
    'deposit': 'Deposit',
    'withdraw': 'Withdraw',
    'liquidate': 'Liquidation',
  };
  return actionMap[action.toLowerCase()] || action;
};

const formatVaultDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface ScaledVaultTransactionItemProps {
  transaction: VaultHistoryTransaction;
  config: DeviceConfig;
  isHighlighted?: boolean;
}

const ScaledVaultTransactionItem = ({ transaction, config, isHighlighted }: ScaledVaultTransactionItemProps) => {
  const actionLower = transaction.action.toLowerCase();

  const getUnitColor = () => {
    if (actionLower === 'borrow' || actionLower === 'open') return COLORS.GREEN;
    return COLORS.RED;
  };

  const getBtcColor = () => {
    if (actionLower === 'deposit') return COLORS.GREEN;
    return COLORS.RED;
  };

  const unitColor = getUnitColor();
  const btcColor = getBtcColor();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: config.padding,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.VERY_DARK_GRAY,
          paddingHorizontal: 8,
          borderRadius: 8,
          marginHorizontal: -8,
        },
        isHighlighted && {
          borderWidth: 1.5,
          borderColor: '#1858E4',
          borderBottomColor: '#1858E4',
          marginVertical: 4,
        },
      ]}
    >
      {/* Vault Icon - scaled */}
      <View style={{ marginRight: config.padding * 0.6 }}>
        <Icon name="vault_logo" size={config.iconSize} color="#DDDDDD" />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {/* Top Row: Action | Confirmed | Amounts */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          {/* Column 1: Action label */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: config.fontSize, fontWeight: '600', color: '#DDDDDD' }}>
              {formatVaultAction(transaction.action)}
            </Text>
          </View>
          {/* Right group: Confirmed chip + Amounts */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 3, justifyContent: 'space-between' }}>
            {/* Column 2: Confirmed chip */}
            <View style={{
              backgroundColor: 'rgba(89, 170, 138, 0.2)',
              paddingHorizontal: config.chipPaddingH,
              paddingVertical: config.chipPaddingV,
              borderRadius: 4,
              minWidth: config.chipMinWidth,
              alignItems: 'center',
            }}>
              <Text style={{ color: COLORS.GREEN, fontSize: config.chipFontSize, fontWeight: '600' }}>
                Confirmed
              </Text>
            </View>
            {/* Column 3: Amounts */}
            <View style={{ alignItems: 'flex-end', minWidth: config.minWidth }}>
              {transaction.unit_amt !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="unit_symbol" size={config.amountIconSize} color={unitColor} style={{ marginRight: 2 }} />
                  <Text style={{ fontSize: config.amountFontSize, fontWeight: '600', color: unitColor }}>
                    {formatUnitAmount(Math.abs(transaction.unit_amt))}
                  </Text>
                </View>
              )}
              {transaction.btc_amt !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="btc_symbol" size={config.amountIconSize} color={btcColor} style={{ marginRight: 2 }} />
                  <Text style={{ fontSize: config.amountFontSize, fontWeight: '600', color: btcColor }}>
                    {formatBalance(Math.abs(transaction.btc_amt) / 100_000_000)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bottom Row: Date */}
        <Text style={{ fontSize: config.dateFontSize, color: COLORS.SECONDARY_TEXT }}>
          {formatVaultDate(transaction.timestamp)}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// CHART DIMENSIONS
// ============================================================================
const DEFAULT_CHART_WIDTH = 358; // Medium device default
const CHART_HEIGHT = 160;
const PADDING = { top: 20, right: 0, bottom: 0, left: 0 };

// ============================================================================
// PRICE CHART DATA GENERATOR
// ============================================================================

const generateSmoothData = (
  points: number,
  startPrice: number,
  trend: 'up' | 'down' | 'stable',
  volatility: number = 0.02
): number[] => {
  const data: number[] = [];
  let price = startPrice;
  const trendBias = trend === 'up' ? 0.002 : trend === 'down' ? -0.002 : 0;

  for (let i = 0; i < points; i++) {
    const wave = Math.sin(i * 0.15) * startPrice * volatility * 0.5;
    const noise = (Math.random() - 0.5) * startPrice * volatility * 0.3;
    price = price * (1 + trendBias) + wave * 0.1 + noise;
    data.push(price);
  }

  if (trend === 'up' && data[data.length - 1] < data[0]) {
    const adjustment = data[0] - data[data.length - 1] + startPrice * 0.03;
    data.forEach((_, i) => {
      data[i] += adjustment * (i / points);
    });
  } else if (trend === 'down' && data[data.length - 1] > data[0]) {
    const adjustment = data[data.length - 1] - data[0] + startPrice * 0.03;
    data.forEach((_, i) => {
      data[i] -= adjustment * (i / points);
    });
  }

  return data;
};

// ============================================================================
// PRICE CHART PATH GENERATOR
// ============================================================================

const generateChartPath = (
  data: number[],
  width: number,
  height: number,
  padding: typeof PADDING
): { linePath: string; areaPath: string } => {
  if (data.length === 0) return { linePath: '', areaPath: '' };

  const drawWidth = width - padding.left - padding.right;
  const drawHeight = height - padding.top - padding.bottom;
  const min = Math.min(...data) * 0.998;
  const max = Math.max(...data) * 1.002;
  const range = max - min || 1;

  const points = data.map((value, index) => ({
    x: padding.left + (index / (data.length - 1)) * drawWidth,
    y: padding.top + drawHeight - ((value - min) / range) * drawHeight,
  }));

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = prev.x + (curr.x - prev.x) * 0.5;
    linePath += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${height} L ${padding.left} ${height} Z`;

  return { linePath, areaPath };
};

// ============================================================================
// PRICE CHART COMPONENT
// ============================================================================

const PriceChart = ({
  data,
  isPositive,
  showScrubber = false,
  scrubberPosition = 0.7,
  width = DEFAULT_CHART_WIDTH,
}: {
  data: number[];
  isPositive: boolean;
  showScrubber?: boolean;
  scrubberPosition?: number;
  width?: number;
}) => {
  const { linePath, areaPath } = generateChartPath(data, width, CHART_HEIGHT, PADDING);
  const strokeColor = isPositive ? '#59AA8A' : '#D04C68';

  const scrubX = PADDING.left + scrubberPosition * (width - PADDING.left - PADDING.right);
  const dataIndex = Math.floor(scrubberPosition * (data.length - 1));
  const min = Math.min(...data) * 0.998;
  const max = Math.max(...data) * 1.002;
  const range = max - min || 1;
  const drawHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const scrubY = PADDING.top + drawHeight - ((data[dataIndex] - min) / range) * drawHeight;

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      <Defs>
        <LinearGradient id={`priceGradient-${isPositive}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <Stop offset="60%" stopColor={strokeColor} stopOpacity="0.1" />
          <Stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      <Path d={areaPath} fill={`url(#priceGradient-${isPositive})`} />
      <Path
        d={linePath}
        stroke={strokeColor}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {showScrubber && (
        <G>
          <Line
            x1={scrubX}
            y1={scrubY + 8}
            x2={scrubX}
            y2={CHART_HEIGHT}
            stroke={strokeColor}
            strokeWidth={1}
            opacity={0.6}
          />
          <Circle cx={scrubX} cy={scrubY} r={7} fill={strokeColor} />
          <Circle cx={scrubX} cy={scrubY} r={3.5} fill="#fff" />
        </G>
      )}
    </Svg>
  );
};

// ============================================================================
// PRICE CHIP
// ============================================================================

const PriceChip = ({ price, isPositive }: { price: string; isPositive: boolean }) => {
  const color = isPositive ? '#59AA8A' : '#D04C68';
  const bgColor = isPositive ? 'rgba(89, 170, 138, 0.12)' : 'rgba(208, 76, 104, 0.12)';

  return (
    <View style={[styles.priceChip, { backgroundColor: bgColor, borderColor: color }]}>
      <Text style={[styles.priceChipText, { color }]}>{price}</Text>
    </View>
  );
};

// ============================================================================
// TIMEFRAME SELECTOR
// ============================================================================

const TimeframeSelector = ({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (tf: string) => void;
}) => {
  const timeframes = ['1D', '1W', '1M', '1Y'];

  return (
    <View style={styles.timeframeContainer}>
      {timeframes.map((tf) => (
        <TouchableOpacity
          key={tf}
          style={[styles.timeframeButton, selected === tf && styles.timeframeButtonActive]}
          onPress={() => onSelect(tf)}
        >
          <Text style={[styles.timeframeText, selected === tf && styles.timeframeTextActive]}>
            {tf}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ============================================================================
// VAULT HEALTH CHART - Exact replica of app component
// ============================================================================

const VAULT_CHART_HEIGHT = 160;
const VAULT_PADDING = { top: 25, right: 0, bottom: 15, left: 0 };

interface VaultDataPoint {
  timestamp: number;
  health: number;
}

interface VaultEvent {
  timestamp: number;
  prevHealth: number;
  newHealth: number;
}

const VaultHealthChart = ({
  data,
  events,
  currentHealth,
  showScrubber = false,
  scrubberPosition = 0.8,
  width = DEFAULT_CHART_WIDTH,
}: {
  data: VaultDataPoint[];
  events: VaultEvent[];
  currentHealth: number;
  showScrubber?: boolean;
  scrubberPosition?: number;
  width?: number;
}) => {
  // Y domain - always include 135 threshold, like the real component
  const yDomain = useMemo(() => {
    if (!data.length) return [125, 350];
    const values = data.map((d) => d.health);
    const dataMax = Math.max(...values);
    const min = 125;
    const headroom = (dataMax - min) * 0.1;
    const max = Math.max(dataMax + headroom, 250);
    return [min, max];
  }, [data]);

  const drawHeight = VAULT_CHART_HEIGHT - VAULT_PADDING.top - VAULT_PADDING.bottom;

  // Scale functions
  const xScale = (timestamp: number) => {
    if (!data.length) return 0;
    const minX = data[0].timestamp;
    const maxX = data[data.length - 1].timestamp;
    const range = maxX - minX || 1;
    return VAULT_PADDING.left + ((timestamp - minX) / range) * width;
  };

  const yScale = (value: number) => {
    const [minY, maxY] = yDomain;
    const range = maxY - minY || 1;
    return VAULT_PADDING.top + drawHeight - ((value - minY) / range) * drawHeight;
  };

  // Generate line segments (break at events)
  const lineSegments = useMemo(() => {
    if (!data.length) return [];

    const eventTimestamps = new Set(events.map((e) => e.timestamp));
    const segments: string[] = [];
    let currentPath = '';

    for (let i = 0; i < data.length; i++) {
      const x = xScale(data[i].timestamp);
      const y = yScale(data[i].health);

      if (eventTimestamps.has(data[i].timestamp)) {
        // Event point - find the event
        const event = events.find((e) => e.timestamp === data[i].timestamp);
        if (event) {
          // End current segment at prevHealth
          const prevY = yScale(event.prevHealth);
          if (currentPath === '') {
            currentPath = `M ${x} ${prevY}`;
          } else {
            currentPath += ` L ${x} ${prevY}`;
          }
          segments.push(currentPath);

          // Start new segment at newHealth
          const newY = yScale(event.newHealth);
          currentPath = `M ${x} ${newY}`;
        }
      } else {
        if (currentPath === '') {
          currentPath = `M ${x} ${y}`;
        } else {
          currentPath += ` L ${x} ${y}`;
        }
      }
    }

    if (currentPath) segments.push(currentPath);
    return segments;
  }, [data, events, yDomain]);

  // Generate area path - handles vertical drops at events
  const areaPath = useMemo(() => {
    if (!data.length) return '';

    const bottomY = VAULT_PADDING.top + drawHeight;
    const firstX = xScale(data[0].timestamp);
    const lastX = xScale(data[data.length - 1].timestamp);

    let path = `M ${firstX} ${bottomY}`;
    path += ` L ${firstX} ${yScale(data[0].health)}`;

    for (let i = 1; i < data.length; i++) {
      const x = xScale(data[i].timestamp);
      const event = events.find((e) => e.timestamp === data[i].timestamp);

      if (event) {
        // At event: first draw to prevHealth, then drop to newHealth
        path += ` L ${x} ${yScale(event.prevHealth)}`;
        path += ` L ${x} ${yScale(event.newHealth)}`;
      } else {
        path += ` L ${x} ${yScale(data[i].health)}`;
      }
    }

    path += ` L ${lastX} ${bottomY} Z`;
    return path;
  }, [data, events, yDomain, drawHeight]);

  // Health colors
  const getHealthColor = (value: number) => {
    if (value <= 160) return '#D04C68';
    if (value <= 200) return '#FDE37B';
    return '#59AA8A';
  };

  const healthColor = getHealthColor(currentHealth);
  const healthChipBg =
    currentHealth <= 160
      ? 'rgba(208, 76, 104, 0.1)'
      : currentHealth <= 200
        ? 'rgba(253, 227, 123, 0.1)'
        : 'rgba(89, 170, 138, 0.1)';

  // Gradient stop offsets - calculated like the real component
  const greenOffset = Math.max(0, (yDomain[1] - 200) / (yDomain[1] - yDomain[0]));
  const yellowOffset = Math.max(0, (yDomain[1] - 160) / (yDomain[1] - yDomain[0]));

  // Scrubber position
  const scrubX = VAULT_PADDING.left + scrubberPosition * width;
  const scrubHealth =
    data.length > 0 ? data[Math.floor(scrubberPosition * (data.length - 1))].health : currentHealth;
  const scrubY = yScale(scrubHealth);

  return (
    <View style={[styles.vaultContainer, { width }]}>
      <View
        style={[styles.healthChip, { backgroundColor: healthChipBg, borderColor: healthColor }]}
      >
        <Text style={[styles.healthChipText, { color: healthColor }]}>
          {Math.round(currentHealth)}%
        </Text>
      </View>

      <Svg width={width} height={VAULT_CHART_HEIGHT}>
        <Defs>
          {/* Area gradient - matches real component exactly */}
          <LinearGradient
            id="vaultAreaGradient"
            x1="0"
            y1={yScale(yDomain[1])}
            x2="0"
            y2={yScale(yDomain[0])}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset={greenOffset} stopColor="#59AA8A" stopOpacity="0.15" />
            <Stop offset={yellowOffset} stopColor="#FDE37B" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#D04C68" stopOpacity="0.05" />
          </LinearGradient>

          {/* Line gradient */}
          <LinearGradient
            id="vaultLineGradient"
            x1="0"
            y1={yScale(yDomain[1])}
            x2="0"
            y2={yScale(yDomain[0])}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset={greenOffset} stopColor="#59AA8A" stopOpacity="1" />
            <Stop offset={yellowOffset} stopColor="#FDE37B" stopOpacity="1" />
            <Stop offset="1" stopColor="#D04C68" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Area fill */}
        <Path d={areaPath} fill="url(#vaultAreaGradient)" />

        {/* Line segments */}
        {lineSegments.map((segment, i) => (
          <Path key={i} d={segment} stroke="url(#vaultLineGradient)" strokeWidth={2} fill="none" />
        ))}

        {/* Event vertical lines */}
        {events.map((event, i) => (
          <Line
            key={i}
            x1={xScale(event.timestamp)}
            x2={xScale(event.timestamp)}
            y1={yScale(event.prevHealth)}
            y2={yScale(event.newHealth)}
            stroke="url(#vaultLineGradient)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}

        {/* Scrubber */}
        {showScrubber && (
          <G>
            <Line
              x1={scrubX}
              x2={scrubX}
              y1={scrubY + 6}
              y2={VAULT_CHART_HEIGHT - VAULT_PADDING.bottom}
              stroke={healthColor}
              strokeWidth={1}
            />
            <Circle cx={scrubX} cy={scrubY} r={6} fill={healthColor} />
            <Circle cx={scrubX} cy={scrubY} r={3} fill="#fff" />
          </G>
        )}
      </Svg>
    </View>
  );
};

// ============================================================================
// INTERACTIVE CHART WRAPPER - Handles scrubbing gestures
// ============================================================================

interface ScrubberProps {
  onScrub: (position: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  children: React.ReactNode;
  style?: any;
}

const ChartScrubberWrapper = ({
  onScrub,
  onScrubStart,
  onScrubEnd,
  children,
  style,
}: ScrubberProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const getPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    // @ts-expect-error storybook-only DOM API
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      onScrubStart();
      onScrub(getPosition(e.clientX));
    },
    [onScrub, onScrubStart, getPosition]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) {
        onScrub(getPosition(e.clientX));
      }
    },
    [onScrub, getPosition]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      onScrubEnd();
    }
  }, [onScrubEnd]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      onScrubEnd();
    }
  }, [onScrubEnd]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDragging.current = true;
      onScrubStart();
      onScrub(getPosition(e.touches[0].clientX));
    },
    [onScrub, onScrubStart, getPosition]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDragging.current) {
        onScrub(getPosition(e.touches[0].clientX));
      }
    },
    [onScrub, getPosition]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      onScrubEnd();
    }
  }, [onScrubEnd]);

  return (
    <div
      ref={containerRef}
      style={{ ...style, userSelect: 'none', touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
};

// ============================================================================
// STORIES
// ============================================================================

interface PriceChartStoryProps {
  deviceSize: DeviceSize;
  trend: 'up' | 'down';
  showScrubber: boolean;
}

const PriceChartStory = ({ deviceSize, trend, showScrubber }: PriceChartStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const [data, setData] = useState(() => generateSmoothData(80, 97000, trend, 0.016));
  const [timeframe, setTimeframe] = useState('1D');
  const [scrubberPosition, setScrubberPosition] = useState(0.75);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Regenerate data when trend changes
  React.useEffect(() => {
    setData(generateSmoothData(80, 97000, trend, 0.016));
  }, [trend]);

  const dataIndex = Math.floor(scrubberPosition * (data.length - 1));
  const currentPrice = showScrubber ? data[dataIndex] : data[data.length - 1];
  const isPositive = currentPrice >= data[0];

  const chartContent = (
    <>
      <PriceChip
        price={`$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        isPositive={isPositive}
      />
      <PriceChart
        data={data}
        isPositive={isPositive}
        showScrubber={showScrubber}
        scrubberPosition={scrubberPosition}
        width={config.chartWidth}
      />
    </>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sizeIndicator}>
        {config.label} {config.width}px
      </Text>
      <Text style={styles.hint}>
        {showScrubber
          ? 'Drag across the chart to scrub'
          : 'Enable scrubber in controls to interact'}
      </Text>
      {showScrubber ? (
        <ChartScrubberWrapper
          onScrub={setScrubberPosition}
          onScrubStart={() => setIsScrubbing(true)}
          onScrubEnd={() => setIsScrubbing(false)}
          style={{ ...styles.chartWrapper, width: config.chartWidth, ...(isScrubbing ? styles.chartWrapperActive : {}) }}
        >
          {chartContent}
        </ChartScrubberWrapper>
      ) : (
        <View style={[styles.chartWrapper, { width: config.chartWidth }]}>{chartContent}</View>
      )}
      <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />
    </View>
  );
};

// Mock transaction data for vault story (matching VaultHistoryTransaction structure)
interface MockTransaction {
  id: string;
  action: 'borrow' | 'repay' | 'deposit' | 'withdraw' | 'open';
  btc_amt: number; // in satoshis
  unit_amt: number; // in cents
  timestamp: number; // Unix timestamp in seconds
  healthBefore: number;
  healthAfter: number;
}

// Format date like VaultTabs (for filter chip)
const formatFilterDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format date like VaultActivityList
const formatTxDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format action for display
const formatAction = (action: string): string => {
  const actionMap: Record<string, string> = {
    open: 'Open Vault',
    borrow: 'Borrow',
    repay: 'Repay',
    deposit: 'Deposit',
    withdraw: 'Withdraw',
  };
  return actionMap[action.toLowerCase()] || action;
};

// Format BTC amount (local version for VaultTransactionCard)
const formatBtcAmount = (satoshis: number): string => {
  const btc = Math.abs(satoshis) / 100_000_000;
  return btc.toFixed(8);
};

// Extended VaultHealthChart with interactive scrubbing (matching real component behavior)
const InteractiveVaultHealthChart = ({
  data,
  events,
  transactions,
  onHighlightEvent,
  onLockFilter,
  width = DEFAULT_CHART_WIDTH,
}: {
  data: VaultDataPoint[];
  events: VaultEvent[];
  transactions: VaultHistoryTransaction[];
  onHighlightEvent?: (txIndex: number | null) => void;
  onLockFilter?: (txIndex: number | null) => void;
  width?: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Scrub state - exactly like the real component
  const [scrubData, setScrubData] = useState<{ health: number | null; x: number | null }>({
    health: null,
    x: null,
  });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);
  const [lockedRefLineIndex, setLockedRefLineIndex] = useState<number | null>(null);
  const [lockedScrubData, setLockedScrubData] = useState<{
    health: number | null;
    x: number | null;
  }>({ health: null, x: null });

  // Y domain calculation
  const yDomain = useMemo(() => {
    if (!data.length) return [125, 350];
    const values = data.map((d) => d.health);
    const dataMax = Math.max(...values);
    const min = 125;
    const headroom = (dataMax - min) * 0.1;
    const max = Math.max(dataMax + headroom, 250);
    return [min, max];
  }, [data]);

  const drawHeight = VAULT_CHART_HEIGHT - VAULT_PADDING.top - VAULT_PADDING.bottom;

  // Scale functions
  const xScale = useCallback(
    (timestamp: number) => {
      if (!data.length) return 0;
      const minX = data[0].timestamp;
      const maxX = data[data.length - 1].timestamp;
      const range = maxX - minX || 1;
      return VAULT_PADDING.left + ((timestamp - minX) / range) * width;
    },
    [data, width]
  );

  const yScale = useCallback(
    (value: number) => {
      const [minY, maxY] = yDomain;
      const range = maxY - minY || 1;
      return VAULT_PADDING.top + drawHeight - ((value - minY) / range) * drawHeight;
    },
    [yDomain, drawHeight]
  );

  // Get health at X position
  const getHealthAtX = useCallback(
    (x: number): number | null => {
      if (!data.length) return null;
      const clampedX = Math.max(0, Math.min(x, width));
      const ratio = clampedX / width;
      const dataIndex = Math.floor(ratio * (data.length - 1));
      return data[dataIndex]?.health || null;
    },
    [data, width]
  );

  // Find nearby reference line (within 15px tolerance for web)
  const findNearbyRefLine = useCallback(
    (x: number): number | null => {
      if (!events.length) return null;
      const tolerance = 15;
      for (let i = 0; i < events.length; i++) {
        const refLineX = xScale(events[i].timestamp);
        if (Math.abs(x - refLineX) <= tolerance) {
          return i;
        }
      }
      return null;
    },
    [events, xScale]
  );

  // Mouse/touch handlers
  const getPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    // @ts-expect-error storybook-only DOM API
    const rect = containerRef.current.getBoundingClientRect();
    return clientX - rect.left;
  }, []);

  const handleStart = useCallback(
    (x: number) => {
      isDragging.current = true;
      // Clear visual lock state on new interaction (but filter stays until new lock)
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null });

      setScrubData({ health: getHealthAtX(x), x });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      onHighlightEvent?.(refLineIdx);
    },
    [getHealthAtX, findNearbyRefLine, onHighlightEvent]
  );

  const handleMove = useCallback(
    (x: number) => {
      if (!isDragging.current) return;
      setScrubData({ health: getHealthAtX(x), x });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      onHighlightEvent?.(refLineIdx);
    },
    [getHealthAtX, findNearbyRefLine, onHighlightEvent]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // If near a reference line, lock to it at exact center
    if (hoveredRefLineIndex !== null && events[hoveredRefLineIndex]) {
      const event = events[hoveredRefLineIndex];
      const exactX = xScale(event.timestamp);
      setLockedRefLineIndex(hoveredRefLineIndex);
      setLockedScrubData({ health: event.newHealth, x: exactX });
      onHighlightEvent?.(hoveredRefLineIndex);
      onLockFilter?.(hoveredRefLineIndex);
    }
    setScrubData({ health: null, x: null });
    setHoveredRefLineIndex(null);
  }, [hoveredRefLineIndex, events, xScale, onHighlightEvent, onLockFilter]);

  // Generate line segments
  const lineSegments = useMemo(() => {
    if (!data.length) return [];
    const eventTimestamps = new Set(events.map((e) => e.timestamp));
    const segments: string[] = [];
    let currentPath = '';

    for (let i = 0; i < data.length; i++) {
      const x = xScale(data[i].timestamp);
      const y = yScale(data[i].health);
      const event = events.find((e) => e.timestamp === data[i].timestamp);

      if (event) {
        const prevY = yScale(event.prevHealth);
        if (currentPath === '') {
          currentPath = `M ${x} ${prevY}`;
        } else {
          currentPath += ` L ${x} ${prevY}`;
        }
        segments.push(currentPath);
        const newY = yScale(event.newHealth);
        currentPath = `M ${x} ${newY}`;
      } else {
        if (currentPath === '') {
          currentPath = `M ${x} ${y}`;
        } else {
          currentPath += ` L ${x} ${y}`;
        }
      }
    }
    if (currentPath) segments.push(currentPath);
    return segments;
  }, [data, events, xScale, yScale]);

  // Generate area path - properly handles vertical drops at events
  const areaPath = useMemo(() => {
    if (!data.length) return '';
    const bottomY = VAULT_PADDING.top + drawHeight;
    const firstX = xScale(data[0].timestamp);
    const lastX = xScale(data[data.length - 1].timestamp);

    let path = `M ${firstX} ${bottomY} L ${firstX} ${yScale(data[0].health)}`;

    for (let i = 1; i < data.length; i++) {
      const x = xScale(data[i].timestamp);
      const event = events.find((e) => e.timestamp === data[i].timestamp);

      if (event) {
        // At event: first draw to prevHealth, then drop to newHealth
        path += ` L ${x} ${yScale(event.prevHealth)}`;
        path += ` L ${x} ${yScale(event.newHealth)}`;
      } else {
        path += ` L ${x} ${yScale(data[i].health)}`;
      }
    }

    path += ` L ${lastX} ${bottomY} Z`;
    return path;
  }, [data, events, xScale, yScale, drawHeight]);

  // Active reference line
  const activeRefLineIndex = hoveredRefLineIndex ?? lockedRefLineIndex;
  const activeRefLine = activeRefLineIndex !== null ? events[activeRefLineIndex] : null;

  // Display health
  const displayHealth =
    scrubData.health ??
    lockedScrubData.health ??
    (data.length > 0 ? data[data.length - 1].health : null);
  const activeScrubX = scrubData.x ?? lockedScrubData.x;
  const activeScrubHealth = scrubData.health ?? lockedScrubData.health;

  // Health color
  const getHealthColor = (value: number | null) => {
    if (!value) return COLORS.SECONDARY_TEXT;
    if (value <= 160) return '#D04C68';
    if (value <= 200) return '#FDE37B';
    return '#59AA8A';
  };

  const healthColor = getHealthColor(displayHealth);
  const healthChipBg = !displayHealth
    ? 'rgba(128, 128, 128, 0.1)'
    : displayHealth <= 160
      ? 'rgba(208, 76, 104, 0.1)'
      : displayHealth <= 200
        ? 'rgba(253, 227, 123, 0.1)'
        : 'rgba(89, 170, 138, 0.1)';

  // Gradient stop offsets
  const greenOffset = Math.max(0, (yDomain[1] - 200) / (yDomain[1] - yDomain[0]));
  const yellowOffset = Math.max(0, (yDomain[1] - 160) / (yDomain[1] - yDomain[0]));

  return (
    <View style={[styles.vaultContainer, { width }]}>
      {/* Health chip - shows "X% → Y%" when on a ref line */}
      <View
        style={[styles.healthChip, { backgroundColor: healthChipBg, borderColor: healthColor }]}
      >
        <Text style={[styles.healthChipText, { color: healthColor }]}>
          {activeRefLine
            ? `${activeRefLine.prevHealth.toFixed(0)}% → ${activeRefLine.newHealth.toFixed(0)}%`
            : displayHealth
              ? `${displayHealth.toFixed(0)}%`
              : 'N/A'}
        </Text>
      </View>

      <div
        ref={containerRef}
        style={{ userSelect: 'none', touchAction: 'none', cursor: 'crosshair' }}
        onMouseDown={(e) => handleStart(getPosition(e.clientX))}
        onMouseMove={(e) => handleMove(getPosition(e.clientX))}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(getPosition(e.touches[0].clientX))}
        onTouchMove={(e) => handleMove(getPosition(e.touches[0].clientX))}
        onTouchEnd={handleEnd}
      >
        <Svg width={width} height={VAULT_CHART_HEIGHT}>
          <Defs>
            <LinearGradient
              id="vaultAreaGradient"
              x1="0"
              y1={yScale(yDomain[1])}
              x2="0"
              y2={yScale(yDomain[0])}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset={greenOffset} stopColor="#59AA8A" stopOpacity="0.15" />
              <Stop offset={yellowOffset} stopColor="#FDE37B" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#D04C68" stopOpacity="0.05" />
            </LinearGradient>
            <LinearGradient
              id="vaultLineGradient"
              x1="0"
              y1={yScale(yDomain[1])}
              x2="0"
              y2={yScale(yDomain[0])}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset={greenOffset} stopColor="#59AA8A" stopOpacity="1" />
              <Stop offset={yellowOffset} stopColor="#FDE37B" stopOpacity="1" />
              <Stop offset="1" stopColor="#D04C68" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          <Path d={areaPath} fill="url(#vaultAreaGradient)" />
          {lineSegments.map((segment, i) => (
            <Path
              key={i}
              d={segment}
              stroke="url(#vaultLineGradient)"
              strokeWidth={2}
              fill="none"
            />
          ))}

          {/* Event vertical lines - thicker when active */}
          {events.map((event, i) => (
            <Line
              key={i}
              x1={xScale(event.timestamp)}
              x2={xScale(event.timestamp)}
              y1={yScale(event.prevHealth)}
              y2={yScale(event.newHealth)}
              stroke="url(#vaultLineGradient)"
              strokeWidth={hoveredRefLineIndex === i || lockedRefLineIndex === i ? 3 : 2}
              strokeLinecap="round"
            />
          ))}

          {/* Locked scrubber - show when locked and not actively scrubbing */}
          {lockedScrubData.x !== null && scrubData.x === null && (
            <G>
              <Line
                x1={lockedScrubData.x}
                x2={lockedScrubData.x}
                y1={yScale(lockedScrubData.health || 0) + 6}
                y2={VAULT_CHART_HEIGHT - VAULT_PADDING.bottom}
                stroke={healthColor}
                strokeWidth={1}
              />
              <Circle
                cx={lockedScrubData.x}
                cy={yScale(lockedScrubData.health || 0)}
                r={6}
                fill={healthColor}
              />
              <Circle
                cx={lockedScrubData.x}
                cy={yScale(lockedScrubData.health || 0)}
                r={3}
                fill="#fff"
              />
            </G>
          )}

          {/* Active scrubber */}
          {scrubData.x !== null && (
            <G>
              <Line
                x1={scrubData.x}
                x2={scrubData.x}
                y1={yScale(scrubData.health || 0) + 6}
                y2={VAULT_CHART_HEIGHT - VAULT_PADDING.bottom}
                stroke={getHealthColor(scrubData.health)}
                strokeWidth={1}
              />
              <Circle
                cx={scrubData.x}
                cy={yScale(scrubData.health || 0)}
                r={6}
                fill={getHealthColor(scrubData.health)}
              />
              <Circle cx={scrubData.x} cy={yScale(scrubData.health || 0)} r={3} fill="#fff" />
            </G>
          )}
        </Svg>
      </div>
    </View>
  );
};

// Vault Transaction Card component (matching VaultActivityList style)
const VaultTransactionCard = ({
  transaction,
  isHighlighted,
  onPress,
}: {
  transaction: MockTransaction;
  isHighlighted?: boolean;
  onPress?: () => void;
}) => {
  const actionLower = transaction.action.toLowerCase();

  // UNIT color: green for borrow, red for repay
  const getUnitColor = () => {
    if (actionLower === 'borrow' || actionLower === 'open') return '#59AA8A';
    return '#D04C68';
  };

  // BTC color: green for deposit, red for withdraw
  const getBtcColor = () => {
    if (actionLower === 'deposit') return '#59AA8A';
    return '#D04C68';
  };

  return (
    <TouchableOpacity
      style={[styles.vaultTxCard, isHighlighted && styles.vaultTxCardHighlighted]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Vault Icon */}
      <View style={styles.vaultTxIconContainer}>
        <Svg width={40} height={40} viewBox="0 0 40 40">
          <Circle cx={20} cy={20} r={18} fill="#2A2A2A" />
          <Path d="M14 16h12v10H14V16zm2 2v6h8v-6h-8zm2 1h4v4h-4v-4z" fill="#DDDDDD" />
        </Svg>
      </View>

      {/* Content */}
      <View style={styles.vaultTxContent}>
        {/* Top Row */}
        <View style={styles.vaultTxTopRow}>
          {/* Action */}
          <Text style={styles.vaultTxAction}>{formatAction(transaction.action)}</Text>

          {/* Confirmed Chip + Amounts */}
          <View style={styles.vaultTxRightGroup}>
            <View style={styles.confirmedChip}>
              <Text style={styles.confirmedChipText}>Confirmed</Text>
            </View>

            <View style={styles.vaultTxAmounts}>
              {transaction.unit_amt !== 0 && (
                <View style={styles.amountRow}>
                  <Text style={[styles.amountSymbol, { color: getUnitColor() }]}>Ü</Text>
                  <Text style={[styles.amountValue, { color: getUnitColor() }]}>
                    {formatUnitAmount(transaction.unit_amt)}
                  </Text>
                </View>
              )}
              {transaction.btc_amt !== 0 && (
                <View style={styles.amountRow}>
                  <Text style={[styles.amountSymbol, { color: getBtcColor() }]}>₿</Text>
                  <Text style={[styles.amountValue, { color: getBtcColor() }]}>
                    {formatBtcAmount(transaction.btc_amt)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Date */}
        <Text style={styles.vaultTxDate}>{formatTxDate(transaction.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Action types for random generation
const ACTION_TYPES: Array<'borrow' | 'repay' | 'deposit' | 'withdraw'> = [
  'borrow',
  'repay',
  'deposit',
  'withdraw',
];

// Generate chart data with configurable event count (2-10)
const generateVaultChartData = (eventCount: number = 2) => {
  const now = Date.now();
  const clampedCount = Math.max(2, Math.min(10, eventCount));

  // Generate random event positions spread across the chart
  const totalHours = 168; // 1 week
  const eventSpacing = Math.floor(totalHours / (clampedCount + 1));

  const points: VaultDataPoint[] = [];
  const events: VaultEvent[] = [];
  const transactions: VaultHistoryTransaction[] = [];

  let health = 220 + Math.random() * 40; // Start between 220-260
  let currentHour = 0;
  let eventIndex = 0;
  let vaultAmount = 15000000; // 0.15 BTC in sats
  let amountBorrowed = 500000; // 5000 UNIT in cents

  // Pre-calculate event times
  const eventHours: number[] = [];
  for (let i = 0; i < clampedCount; i++) {
    eventHours.push(eventSpacing * (i + 1) + Math.floor(Math.random() * (eventSpacing / 2)));
  }

  while (currentHour <= totalHours) {
    const timestamp = now - (totalHours - currentHour) * 3600000;

    // Check if this is an event hour
    if (eventIndex < eventHours.length && currentHour >= eventHours[eventIndex]) {
      const prevHealth = health;
      const action = ACTION_TYPES[Math.floor(Math.random() * ACTION_TYPES.length)];

      // Calculate health change based on action
      let healthChange: number;
      const btcAmt = Math.floor(Math.random() * 5000000) + 500000;
      const unitAmt = Math.floor(Math.random() * 100000) + 10000;

      if (action === 'borrow') {
        healthChange = -(20 + Math.random() * 50);
        amountBorrowed += unitAmt;
      } else if (action === 'repay') {
        healthChange = 20 + Math.random() * 50;
        amountBorrowed = Math.max(0, amountBorrowed - unitAmt);
      } else if (action === 'deposit') {
        healthChange = 20 + Math.random() * 50;
        vaultAmount += btcAmt;
      } else {
        // withdraw
        healthChange = -(20 + Math.random() * 50);
        vaultAmount = Math.max(0, vaultAmount - btcAmt);
      }

      health = Math.max(130, Math.min(280, health + healthChange));

      const eventTime = timestamp;
      const eventTimeSec = Math.floor(eventTime / 1000);

      events.push({
        timestamp: eventTime,
        prevHealth,
        newHealth: health,
      });

      // Create VaultHistoryTransaction object
      transactions.push({
        action,
        btc_amt: action === 'deposit' || action === 'withdraw' ? btcAmt : 0,
        unit_amt: action === 'borrow' || action === 'repay' ? unitAmt : 0,
        timestamp: eventTimeSec,
        vault_amount: vaultAmount,
        amount_borrowed: amountBorrowed,
        oracle_price: 95000 + Math.floor(Math.random() * 5000),
      });

      points.push({ timestamp: eventTime, health });
      eventIndex++;
    } else {
      // Normal point - slight drift
      health += (Math.random() - 0.5) * 3;
      health = Math.max(130, Math.min(280, health));
      points.push({ timestamp, health });
    }

    currentHour += 2; // 2-hour intervals
  }

  return { points, events, transactions };
};

// Scrub-only VaultHealthChart (no locking)
const ScrubOnlyVaultHealthChart = ({
  data,
  events,
  onScrubHealth,
  width = DEFAULT_CHART_WIDTH,
}: {
  data: VaultDataPoint[];
  events: VaultEvent[];
  onScrubHealth?: (health: number | null, refLine: VaultEvent | null) => void;
  width?: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [scrubData, setScrubData] = useState<{ health: number | null; x: number | null }>({
    health: null,
    x: null,
  });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);

  const yDomain = useMemo(() => {
    if (!data.length) return [125, 350];
    const values = data.map((d) => d.health);
    const dataMax = Math.max(...values);
    const min = 125;
    const headroom = (dataMax - min) * 0.1;
    const max = Math.max(dataMax + headroom, 250);
    return [min, max];
  }, [data]);

  const drawHeight = VAULT_CHART_HEIGHT - VAULT_PADDING.top - VAULT_PADDING.bottom;

  const xScale = useCallback(
    (timestamp: number) => {
      if (!data.length) return 0;
      const minX = data[0].timestamp;
      const maxX = data[data.length - 1].timestamp;
      const range = maxX - minX || 1;
      return VAULT_PADDING.left + ((timestamp - minX) / range) * width;
    },
    [data, width]
  );

  const yScale = useCallback(
    (value: number) => {
      const [minY, maxY] = yDomain;
      const range = maxY - minY || 1;
      return VAULT_PADDING.top + drawHeight - ((value - minY) / range) * drawHeight;
    },
    [yDomain, drawHeight]
  );

  const getHealthAtX = useCallback(
    (x: number): number | null => {
      if (!data.length) return null;
      const clampedX = Math.max(0, Math.min(x, width));
      const ratio = clampedX / width;
      const dataIndex = Math.floor(ratio * (data.length - 1));
      return data[dataIndex]?.health || null;
    },
    [data, width]
  );

  const findNearbyRefLine = useCallback(
    (x: number): number | null => {
      if (!events.length) return null;
      const tolerance = 15;
      for (let i = 0; i < events.length; i++) {
        const refLineX = xScale(events[i].timestamp);
        if (Math.abs(x - refLineX) <= tolerance) {
          return i;
        }
      }
      return null;
    },
    [events, xScale]
  );

  const getPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    // @ts-expect-error storybook-only DOM API
    const rect = containerRef.current.getBoundingClientRect();
    return clientX - rect.left;
  }, []);

  const handleStart = useCallback(
    (x: number) => {
      isDragging.current = true;
      const health = getHealthAtX(x);
      setScrubData({ health, x });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      onScrubHealth?.(health, refLineIdx !== null ? events[refLineIdx] : null);
    },
    [getHealthAtX, findNearbyRefLine, onScrubHealth, events]
  );

  const handleMove = useCallback(
    (x: number) => {
      if (!isDragging.current) return;
      const health = getHealthAtX(x);
      setScrubData({ health, x });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      onScrubHealth?.(health, refLineIdx !== null ? events[refLineIdx] : null);
    },
    [getHealthAtX, findNearbyRefLine, onScrubHealth, events]
  );

  const handleEnd = useCallback(() => {
    isDragging.current = false;
    setScrubData({ health: null, x: null });
    setHoveredRefLineIndex(null);
    onScrubHealth?.(null, null);
  }, [onScrubHealth]);

  // Line segments
  const lineSegments = useMemo(() => {
    if (!data.length) return [];
    const segments: string[] = [];
    let currentPath = '';
    for (let i = 0; i < data.length; i++) {
      const x = xScale(data[i].timestamp);
      const y = yScale(data[i].health);
      const event = events.find((e) => e.timestamp === data[i].timestamp);
      if (event) {
        const prevY = yScale(event.prevHealth);
        if (currentPath === '') {
          currentPath = `M ${x} ${prevY}`;
        } else {
          currentPath += ` L ${x} ${prevY}`;
        }
        segments.push(currentPath);
        const newY = yScale(event.newHealth);
        currentPath = `M ${x} ${newY}`;
      } else {
        if (currentPath === '') {
          currentPath = `M ${x} ${y}`;
        } else {
          currentPath += ` L ${x} ${y}`;
        }
      }
    }
    if (currentPath) segments.push(currentPath);
    return segments;
  }, [data, events, xScale, yScale]);

  // Area path - properly handles vertical drops at events
  const areaPath = useMemo(() => {
    if (!data.length) return '';
    const bottomY = VAULT_PADDING.top + drawHeight;
    const firstX = xScale(data[0].timestamp);
    const lastX = xScale(data[data.length - 1].timestamp);

    let path = `M ${firstX} ${bottomY} L ${firstX} ${yScale(data[0].health)}`;

    for (let i = 1; i < data.length; i++) {
      const x = xScale(data[i].timestamp);
      const event = events.find((e) => e.timestamp === data[i].timestamp);

      if (event) {
        // At event: first draw to prevHealth, then drop to newHealth
        path += ` L ${x} ${yScale(event.prevHealth)}`;
        path += ` L ${x} ${yScale(event.newHealth)}`;
      } else {
        path += ` L ${x} ${yScale(data[i].health)}`;
      }
    }

    path += ` L ${lastX} ${bottomY} Z`;
    return path;
  }, [data, events, xScale, yScale, drawHeight]);

  const activeRefLine = hoveredRefLineIndex !== null ? events[hoveredRefLineIndex] : null;
  const displayHealth = scrubData.health ?? (data.length > 0 ? data[data.length - 1].health : null);

  const getHealthColor = (value: number | null) => {
    if (!value) return COLORS.SECONDARY_TEXT;
    if (value <= 160) return '#D04C68';
    if (value <= 200) return '#FDE37B';
    return '#59AA8A';
  };

  const healthColor = getHealthColor(displayHealth);
  const healthChipBg = !displayHealth
    ? 'rgba(128, 128, 128, 0.1)'
    : displayHealth <= 160
      ? 'rgba(208, 76, 104, 0.1)'
      : displayHealth <= 200
        ? 'rgba(253, 227, 123, 0.1)'
        : 'rgba(89, 170, 138, 0.1)';

  const greenOffset = Math.max(0, (yDomain[1] - 200) / (yDomain[1] - yDomain[0]));
  const yellowOffset = Math.max(0, (yDomain[1] - 160) / (yDomain[1] - yDomain[0]));

  return (
    <View style={[styles.vaultContainer, { width }]}>
      <View
        style={[styles.healthChip, { backgroundColor: healthChipBg, borderColor: healthColor }]}
      >
        <Text style={[styles.healthChipText, { color: healthColor }]}>
          {activeRefLine
            ? `${activeRefLine.prevHealth.toFixed(0)}% → ${activeRefLine.newHealth.toFixed(0)}%`
            : displayHealth
              ? `${displayHealth.toFixed(0)}%`
              : 'N/A'}
        </Text>
      </View>

      <div
        ref={containerRef}
        style={{ userSelect: 'none', touchAction: 'none', cursor: 'crosshair' }}
        onMouseDown={(e) => handleStart(getPosition(e.clientX))}
        onMouseMove={(e) => handleMove(getPosition(e.clientX))}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(getPosition(e.touches[0].clientX))}
        onTouchMove={(e) => handleMove(getPosition(e.touches[0].clientX))}
        onTouchEnd={handleEnd}
      >
        <Svg width={width} height={VAULT_CHART_HEIGHT}>
          <Defs>
            <LinearGradient
              id="scrubAreaGradient"
              x1="0"
              y1={yScale(yDomain[1])}
              x2="0"
              y2={yScale(yDomain[0])}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset={greenOffset} stopColor="#59AA8A" stopOpacity="0.15" />
              <Stop offset={yellowOffset} stopColor="#FDE37B" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#D04C68" stopOpacity="0.05" />
            </LinearGradient>
            <LinearGradient
              id="scrubLineGradient"
              x1="0"
              y1={yScale(yDomain[1])}
              x2="0"
              y2={yScale(yDomain[0])}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset={greenOffset} stopColor="#59AA8A" stopOpacity="1" />
              <Stop offset={yellowOffset} stopColor="#FDE37B" stopOpacity="1" />
              <Stop offset="1" stopColor="#D04C68" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          <Path d={areaPath} fill="url(#scrubAreaGradient)" />
          {lineSegments.map((segment, i) => (
            <Path
              key={i}
              d={segment}
              stroke="url(#scrubLineGradient)"
              strokeWidth={2}
              fill="none"
            />
          ))}

          {events.map((event, i) => (
            <Line
              key={i}
              x1={xScale(event.timestamp)}
              x2={xScale(event.timestamp)}
              y1={yScale(event.prevHealth)}
              y2={yScale(event.newHealth)}
              stroke="url(#scrubLineGradient)"
              strokeWidth={hoveredRefLineIndex === i ? 3 : 2}
              strokeLinecap="round"
            />
          ))}

          {scrubData.x !== null && (
            <G>
              <Line
                x1={scrubData.x}
                x2={scrubData.x}
                y1={yScale(scrubData.health || 0) + 6}
                y2={VAULT_CHART_HEIGHT - VAULT_PADDING.bottom}
                stroke={getHealthColor(scrubData.health)}
                strokeWidth={1}
              />
              <Circle
                cx={scrubData.x}
                cy={yScale(scrubData.health || 0)}
                r={6}
                fill={getHealthColor(scrubData.health)}
              />
              <Circle cx={scrubData.x} cy={yScale(scrubData.health || 0)} r={3} fill="#fff" />
            </G>
          )}
        </Svg>
      </div>
    </View>
  );
};

// ============================================================================
// VAULT HEALTH WITH FILTER STORY
// ============================================================================
interface VaultStoryProps {
  deviceSize: DeviceSize;
  eventCount: number;
}

interface VaultHealthStoryProps extends VaultStoryProps {
  showFilter: boolean;
}

const VaultHealthStory = ({ deviceSize, eventCount, showFilter }: VaultHealthStoryProps) => {
  const config = DEVICE_SIZES[deviceSize];
  const [chartData, setChartData] = useState(() => generateVaultChartData(eventCount));
  const [timeframe, setTimeframe] = useState('1W');
  const [highlightedTxIndex, setHighlightedTxIndex] = useState<number | null>(null);
  const [filterDate, setFilterDate] = useState<number | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<VaultEvent | null>(null);

  // Regenerate data when eventCount changes
  React.useEffect(() => {
    setChartData(generateVaultChartData(eventCount));
    setFilterDate(null);
    setHighlightedTxIndex(null);
    setHoveredEvent(null);
  }, [eventCount]);

  // Clear filter when showFilter is toggled off
  React.useEffect(() => {
    if (!showFilter) {
      setFilterDate(null);
      setHighlightedTxIndex(null);
    }
  }, [showFilter]);

  const handleClearFilter = useCallback(() => {
    setFilterDate(null);
    setHighlightedTxIndex(null);
  }, []);

  const handleLockFilter = useCallback(
    (txIndex: number | null) => {
      if (txIndex !== null && chartData.transactions[txIndex]) {
        const tx = chartData.transactions[txIndex];
        setFilterDate(tx.timestamp * 1000);
      }
    },
    [chartData.transactions]
  );

  const handleScrubHealth = useCallback((_health: number | null, refLine: VaultEvent | null) => {
    setHoveredEvent(refLine);
  }, []);

  // Filter transactions based on filterDate (only when filter is enabled)
  const visibleTransactions = useMemo(() => {
    if (!showFilter || !filterDate) return chartData.transactions;
    return chartData.transactions.filter((tx) => {
      const txMs = tx.timestamp * 1000;
      const filterDay = new Date(filterDate);
      const startOfDay = new Date(
        filterDay.getFullYear(),
        filterDay.getMonth(),
        filterDay.getDate()
      ).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
      return txMs >= startOfDay && txMs <= endOfDay;
    });
  }, [chartData.transactions, filterDate, showFilter]);

  return (
    <View style={styles.container}>
      <Text style={styles.sizeIndicator}>
        {config.label} {config.width}px
      </Text>
      <Text style={styles.hint}>
        {showFilter
          ? `Drag across chart - release near event to lock and filter (${eventCount} events)`
          : `Drag to view health values (${eventCount} events)`}
      </Text>

      <View style={[styles.vaultChartWrapper, { width: config.chartWidth }]}>
        {showFilter ? (
          <InteractiveVaultHealthChart
            data={chartData.points}
            events={chartData.events}
            transactions={chartData.transactions}
            onHighlightEvent={setHighlightedTxIndex}
            onLockFilter={handleLockFilter}
            width={config.chartWidth}
          />
        ) : (
          <ScrubOnlyVaultHealthChart
            data={chartData.points}
            events={chartData.events}
            onScrubHealth={handleScrubHealth}
            width={config.chartWidth}
          />
        )}
      </View>

      <TimeframeSelector
        selected={timeframe}
        onSelect={(tf) => {
          setTimeframe(tf);
          setFilterDate(null);
          setHighlightedTxIndex(null);
        }}
      />

      {/* Only show tabs and transaction list when filter is enabled */}
      {showFilter && (
        <>
          {/* Tabs row with filter date chip */}
          <View style={[styles.tabsContainer, { width: config.width }]}>
            <View style={styles.tabsRow}>
              <TouchableOpacity style={styles.tabActive}>
                <Text style={styles.tabTextActive}>Activity</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tab}>
                <Text style={styles.tabText}>About</Text>
              </TouchableOpacity>
            </View>

            {/* Filter date chip on the right */}
            {filterDate && (
              <TouchableOpacity style={styles.filterDateChip} onPress={handleClearFilter}>
                <Text style={styles.filterDateText}>{formatFilterDate(filterDate)}</Text>
                <Text style={styles.filterCloseIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Transaction list - using scaled vault transaction items */}
          <View style={[styles.txList, { width: config.width, paddingHorizontal: 16 }]}>
            {visibleTransactions.map((tx, index) => {
              // Check if transaction matches filter date (same day)
              const isHighlighted = filterDate ? (() => {
                const txMs = tx.timestamp * 1000;
                const filterDay = new Date(filterDate);
                const startOfDay = new Date(filterDay.getFullYear(), filterDay.getMonth(), filterDay.getDate()).getTime();
                const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
                return txMs >= startOfDay && txMs <= endOfDay;
              })() : false;

              return (
                <ScaledVaultTransactionItem
                  key={`${tx.timestamp}-${index}`}
                  transaction={tx}
                  config={config}
                  isHighlighted={isHighlighted}
                />
              );
            })}
          </View>
        </>
      )}
    </View>
  );
};

// ============================================================================
// DEVICE SIZE OVERVIEW STORY
// ============================================================================
const DeviceSizeOverviewStory = () => {
  const priceData = generateSmoothData(80, 97000, 'up', 0.016);
  const isPositive = priceData[priceData.length - 1] >= priceData[0];
  const vaultData = generateVaultChartData(3);
  const currentHealth = vaultData.points[vaultData.points.length - 1]?.health || 200;

  return (
    <ScrollView contentContainerStyle={styles.overviewContainer}>
      {Object.entries(DEVICE_SIZES).map(([key, config]) => (
        <View key={key} style={styles.deviceSection}>
          <View style={styles.deviceHeader}>
            <Text style={styles.deviceLabel}>{config.label}</Text>
            <Text style={styles.deviceSubtitle}>{config.subtitle} ({config.width}px)</Text>
          </View>
          <View style={styles.chartsRow}>
            {/* Price Chart */}
            <View style={styles.chartColumn}>
              <Text style={styles.chartLabel}>Price Chart</Text>
              <View style={[styles.chartWrapper, { width: config.chartWidth }]}>
                <PriceChip
                  price={`$${priceData[priceData.length - 1].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  isPositive={isPositive}
                />
                <PriceChart
                  data={priceData}
                  isPositive={isPositive}
                  showScrubber={false}
                  width={config.chartWidth}
                />
              </View>
            </View>
            {/* Vault Health Chart */}
            <View style={styles.chartColumn}>
              <Text style={styles.chartLabel}>Vault Health</Text>
              <View style={[styles.vaultChartWrapper, { width: config.chartWidth }]}>
                <VaultHealthChart
                  data={vaultData.points}
                  events={vaultData.events}
                  currentHealth={currentHealth}
                  showScrubber={false}
                  width={config.chartWidth}
                />
              </View>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ============================================================================
// STORYBOOK META
// ============================================================================
const meta: Meta = {
  title: 'Components/Charts',
};

export default meta;
export const PriceChartInteractive: StoryObj<PriceChartStoryProps> = {
  render: (args) => <PriceChartStory {...args} />,
  args: {
    deviceSize: 'M',
    trend: 'up',
    showScrubber: true,
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    trend: {
      control: { type: 'radio' },
      options: ['up', 'down'],
      description: 'Price trend direction',
    },
    showScrubber: {
      control: { type: 'boolean' },
      description: 'Show interactive scrubber',
    },
  },
};

export const VaultHealthInteractive: StoryObj<VaultHealthStoryProps> = {
  render: (args) => <VaultHealthStory {...args} />,
  args: {
    deviceSize: 'XS',
    eventCount: 3,
    showFilter: true,
  },
  argTypes: {
    deviceSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device size preset',
    },
    eventCount: {
      control: { type: 'range', min: 2, max: 10, step: 1 },
      description: 'Number of events to display (2-10)',
    },
    showFilter: {
      control: { type: 'boolean' },
      description: 'Enable filter/lock mode (release near event to filter transactions)',
    },
  },
};

export const DeviceSizeOverview: StoryObj = {
  render: () => <DeviceSizeOverviewStory />,
  parameters: {
    controls: { disable: true },
  },
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
    zIndex: 10,
  },
  deviceFrame: {
    backgroundColor: COLORS.DARK_BG,
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
  },
  chartWrapper: {
    position: 'relative',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    paddingTop: 40,
    paddingBottom: 8,
    width: DEFAULT_CHART_WIDTH,
    cursor: 'pointer',
  },
  chartWrapperActive: {
    opacity: 0.95,
  },
  vaultChartWrapper: {
    position: 'relative',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    paddingTop: 40,
    paddingBottom: 8,
    width: DEFAULT_CHART_WIDTH,
    cursor: 'pointer',
  },
  vaultContainer: {
    position: 'relative',
    width: DEFAULT_CHART_WIDTH,
  },
  priceChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    zIndex: 10,
  },
  priceChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  healthChip: {
    position: 'absolute',
    top: -8,
    right: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  healthChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
    minWidth: 60,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.SECONDARY_TEXT,
  },
  timeframeTextActive: {
    color: '#fff',
  },
  // Filter badge
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
  },
  filterBadgeText: {
    fontSize: 13,
    color: COLORS.WHITE,
    fontWeight: '500',
  },
  filterBadgeClear: {
    fontSize: 13,
    color: COLORS.PRIMARY_BLUE,
    fontWeight: '600',
  },
  // Transaction list
  txList: {
    marginTop: 8,
  },
  // Tabs container (matching VaultTabs)
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: DEFAULT_CHART_WIDTH,
    marginTop: 20,
    marginBottom: 4,
  },
  tabsRow: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
  },
  tabActive: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SECONDARY_TEXT,
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  // Filter date chip (matching VaultTabs)
  filterDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1858E4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  filterDateText: {
    color: '#1858E4',
    fontSize: 12,
    fontWeight: '600',
  },
  filterCloseIcon: {
    color: '#1858E4',
    fontSize: 12,
    fontWeight: '600',
  },
  // Vault Transaction Card (matching VaultActivityList)
  vaultTxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
    borderRadius: 8,
  },
  vaultTxCardHighlighted: {
    borderWidth: 1.5,
    borderColor: '#1858E4',
    borderBottomColor: '#1858E4',
    marginVertical: 4,
  },
  vaultTxIconContainer: {
    marginRight: 10,
  },
  vaultTxContent: {
    flex: 1,
  },
  vaultTxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  vaultTxAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DDDDDD',
    flex: 1,
  },
  vaultTxRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'space-between',
  },
  confirmedChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confirmedChipText: {
    color: '#59AA8A',
    fontSize: 12,
    fontWeight: '600',
  },
  vaultTxAmounts: {
    alignItems: 'flex-end',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountSymbol: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  vaultTxDate: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
  },
  // Device Size Overview styles
  overviewContainer: {
    flexGrow: 1,
    backgroundColor: COLORS.DARK_BG,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
    gap: 32,
  },
  deviceSection: {
    alignItems: 'center',
    gap: 12,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  deviceSubtitle: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '500',
  },
  chartsRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  chartColumn: {
    alignItems: 'center',
    gap: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    fontWeight: '600',
  },
});
