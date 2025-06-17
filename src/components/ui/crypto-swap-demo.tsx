"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  ArrowUpDown, 
  Settings, 
  ChevronDown, 
  Zap, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type Uniforms = {
  [key: string]: {
    value: number[] | number[][] | number;
    type: string;
  };
};

interface ShaderProps {
  source: string;
  uniforms: {
    [key: string]: {
      value: number[] | number[][] | number;
      type: string;
    };
  };
  maxFps?: number;
}

// Animated Background Component with Dot Matrix
export const CanvasRevealEffect = ({
  animationSpeed = 10,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[0, 255, 255]],
  containerClassName,
  dotSize,
  showGradient = true,
  reverse = false,
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  reverse?: boolean;
}) => {
  return (
    <div className={cn("h-full relative w-full", containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors ?? [[0, 255, 255]]}
          dotSize={dotSize ?? 3}
          opacities={
            opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]
          }
          shader={`
            ${reverse ? 'u_reverse_active' : 'false'}_;
            animation_speed_factor_${animationSpeed.toFixed(1)}_;
          `}
          center={["x", "y"]}
        />
      </div>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
      )}
    </div>
  );
};

interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ("x" | "y")[];
}

const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = "",
  center = ["x", "y"],
}) => {
  const uniforms = React.useMemo(() => {
    let colorsArray = [
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
    ];
    if (colors.length === 2) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[1],
      ];
    } else if (colors.length === 3) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[2],
        colors[2],
      ];
    }
    return {
      u_colors: {
        value: colorsArray.map((color) => [
          color[0] / 255,
          color[1] / 255,
          color[2] / 255,
        ]),
        type: "uniform3fv",
      },
      u_opacities: {
        value: opacities,
        type: "uniform1fv",
      },
      u_total_size: {
        value: totalSize,
        type: "uniform1f",
      },
      u_dot_size: {
        value: dotSize,
        type: "uniform1f",
      },
      u_reverse: {
        value: shader.includes("u_reverse_active") ? 1 : 0,
        type: "uniform1i",
      },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;

        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }
        float map(float value, float min1, float max1, float min2, float max2) {
            return min2 + (value - min1) * (max2 - min1) / (max1 - min1);
        }

        void main() {
            vec2 st = fragCoord.xy;
            ${
              center.includes("x")
                ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));"
                : ""
            }
            ${
              center.includes("y")
                ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));"
                : ""
            }

            float opacity = step(0.0, st.x);
            opacity *= step(0.0, st.y);

            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

            vec3 color = u_colors[int(show_offset * 6.0)];

            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);

            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);

            float current_timing_offset;
            if (u_reverse == 1) {
                current_timing_offset = timing_offset_outro;
                opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
                current_timing_offset = timing_offset_intro;
                opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }

            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

const ShaderMaterial = ({
  source,
  uniforms,
  maxFps = 60,
}: {
  source: string;
  hovered?: boolean;
  maxFps?: number;
  uniforms: Uniforms;
}) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  let lastFrameTime = 0;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const timestamp = clock.getElapsedTime();

    lastFrameTime = timestamp;

    const material: any = ref.current.material;
    const timeLocation = material.uniforms.u_time;
    timeLocation.value = timestamp;
  });

  const getUniforms = () => {
    const preparedUniforms: any = {};

    for (const uniformName in uniforms) {
      const uniform: any = uniforms[uniformName];

      switch (uniform.type) {
        case "uniform1f":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1f" };
          break;
        case "uniform1i":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1i" };
          break;
        case "uniform3f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector3().fromArray(uniform.value),
            type: "3f",
          };
          break;
        case "uniform1fv":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1fv" };
          break;
        case "uniform3fv":
          preparedUniforms[uniformName] = {
            value: uniform.value.map((v: number[]) =>
              new THREE.Vector3().fromArray(v)
            ),
            type: "3fv",
          };
          break;
        case "uniform2f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector2().fromArray(uniform.value),
            type: "2f",
          };
          break;
        default:
          console.error(`Invalid uniform type for '${uniformName}'.`);
          break;
      }
    }

    preparedUniforms["u_time"] = { value: 0, type: "1f" };
    preparedUniforms["u_resolution"] = {
      value: new THREE.Vector2(size.width * 2, size.height * 2),
    };
    return preparedUniforms;
  };

  const material = useMemo(() => {
    const materialObject = new THREE.ShaderMaterial({
      vertexShader: `
      precision mediump float;
      in vec2 coordinates;
      uniform vec2 u_resolution;
      out vec2 fragCoord;
      void main(){
        float x = position.x;
        float y = position.y;
        gl_Position = vec4(x, y, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }
      `,
      fragmentShader: source,
      uniforms: getUniforms(),
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });

    return materialObject;
  }, [size.width, size.height, source]);

  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => {
  return (
    <Canvas className="absolute inset-0 h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
};

// Hook for click outside functionality
function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
  mouseEvent: 'mousedown' | 'mouseup' = 'mousedown'
): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref?.current;
      const target = event.target;

      if (!el || !target || el.contains(target as Node)) {
        return;
      }

      handler(event);
    };

    document.addEventListener(mouseEvent, listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener(mouseEvent, listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, mouseEvent]);
}

interface Token {
  symbol: string;
  name: string;
  icon: string;
  balance: string;
  price: number;
  change24h: number;
  address: string;
}

interface SwapState {
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  slippage: number;
  isLoading: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
}

const defaultTokens: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '⟠',
    balance: '2.5847',
    price: 2340.50,
    change24h: 5.2,
    address: '0x0000000000000000000000000000000000000000'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '💵',
    balance: '1,250.00',
    price: 1.00,
    change24h: 0.1,
    address: '0xa0b86a33e6c3b4c6b6b6b6b6b6b6b6b6b6b6b6b6'
  },
  {
    symbol: 'UNI',
    name: 'Uniswap',
    icon: '🦄',
    balance: '45.2',
    price: 8.45,
    change24h: -2.1,
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    icon: '🔗',
    balance: '120.5',
    price: 14.25,
    change24h: 3.8,
    address: '0x514910771af9ca656af840dff83e8264ecf986ca'
  }
];

function CryptoSwapBox() {
  const shouldReduceMotion = useReducedMotion();
  const [swapState, setSwapState] = useState<SwapState>({
    fromToken: defaultTokens[0],
    toToken: defaultTokens[1],
    fromAmount: '',
    toAmount: '',
    slippage: 0.5,
    isLoading: false,
    status: 'idle'
  });

  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tokenSelectorRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useClickOutside(tokenSelectorRef, () => setShowTokenSelector(null));
  useClickOutside(settingsRef, () => setShowSettings(false));

  // Mouse tracking for glow effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };

    if (isHovering) {
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isHovering]);

  // Calculate exchange rate and amounts
  useEffect(() => {
    if (swapState.fromAmount && !isNaN(Number(swapState.fromAmount))) {
      const fromValue = Number(swapState.fromAmount) * swapState.fromToken.price;
      const toAmount = (fromValue / swapState.toToken.price).toFixed(6);
      setSwapState(prev => ({ ...prev, toAmount }));
    } else {
      setSwapState(prev => ({ ...prev, toAmount: '' }));
    }
  }, [swapState.fromAmount, swapState.fromToken.price, swapState.toToken.price]);

  const handleTokenSelect = (token: Token) => {
    if (showTokenSelector === 'from') {
      setSwapState(prev => ({ ...prev, fromToken: token }));
    } else if (showTokenSelector === 'to') {
      setSwapState(prev => ({ ...prev, toToken: token }));
    }
    setShowTokenSelector(null);
  };

  const handleSwapTokens = () => {
    setIsSwapping(true);
    setTimeout(() => {
      setSwapState(prev => ({
        ...prev,
        fromToken: prev.toToken,
        toToken: prev.fromToken,
        fromAmount: prev.toAmount,
        toAmount: prev.fromAmount
      }));
      setIsSwapping(false);
    }, 300);
  };

  const handleSwap = async () => {
    if (!swapState.fromAmount || Number(swapState.fromAmount) <= 0) return;

    setSwapState(prev => ({ ...prev, status: 'loading', isLoading: true }));

    // Simulate swap transaction
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSwapState(prev => ({ 
        ...prev, 
        status: 'success', 
        isLoading: false,
        fromAmount: '',
        toAmount: ''
      }));
      
      setTimeout(() => {
        setSwapState(prev => ({ ...prev, status: 'idle' }));
      }, 2000);
    } catch (error) {
      setSwapState(prev => ({ 
        ...prev, 
        status: 'error', 
        isLoading: false,
        error: 'Swap failed. Please try again.'
      }));
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20, filter: 'blur(4px)' },
    visible: {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 28,
        mass: 0.6
      }
    }
  };

  const glowVariants = {
    idle: { opacity: 0 },
    hover: { 
      opacity: 1,
      transition: { duration: 0.3 }
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full max-w-md mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-yellow-500/20 to-green-500/20 rounded-3xl blur-xl"
        variants={glowVariants}
        animate={isHovering ? 'hover' : 'idle'}
        style={{
          background: isHovering 
            ? `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(34, 197, 94, 0.3) 0%, rgba(234, 179, 8, 0.2) 50%, transparent 70%)`
            : undefined
        }}
      />

      {/* Main swap container */}
      <motion.div
        className="relative bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
        variants={itemVariants}
      >
        {/* Header */}
        <motion.div 
          className="flex items-center justify-between mb-8"
          variants={itemVariants}
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Zap className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-white">Swap</h1>
              <p className="text-sm text-white/60">Trade tokens instantly</p>
            </div>
          </div>
          
          <motion.button
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSettings(true)}
          >
            <Settings className="w-5 h-5 text-white/70" />
          </motion.button>
        </motion.div>

        {/* From Token */}
        <motion.div
          className="relative mb-4"
          variants={itemVariants}
        >
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">From</span>
              <span className="text-sm text-white/60">
                Balance: {swapState.fromToken.balance}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <motion.button
                className="flex items-center gap-3 bg-white/10 rounded-full px-4 py-3 hover:bg-white/15 transition-colors backdrop-blur-sm flex-shrink-0"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowTokenSelector('from')}
              >
                <span className="text-2xl">{swapState.fromToken.icon}</span>
                <span className="font-semibold text-white">{swapState.fromToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-white/60" />
              </motion.button>
              
              <input
                type="number"
                placeholder="0.0"
                value={swapState.fromAmount}
                onChange={(e) => setSwapState(prev => ({ ...prev, fromAmount: e.target.value }))}
                className="flex-1 bg-transparent text-right text-2xl font-light outline-none placeholder:text-white/40 text-white min-w-0"
              />
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-white/50">
                ${swapState.fromToken.price.toLocaleString()}
              </span>
              <span className="text-xs text-white/50">
                ≈ ${(Number(swapState.fromAmount || 0) * swapState.fromToken.price).toFixed(2)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Swap Button */}
        <motion.div 
          className="flex justify-center -my-2 relative z-10"
          variants={itemVariants}
        >
          <motion.button
            className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/20"
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: isSwapping ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={handleSwapTokens}
          >
            <ArrowUpDown className="w-6 h-6 text-white" />
          </motion.button>
        </motion.div>

        {/* To Token */}
        <motion.div
          className="relative mb-8"
          variants={itemVariants}
        >
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">To</span>
              <span className="text-sm text-white/60">
                Balance: {swapState.toToken.balance}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <motion.button
                className="flex items-center gap-3 bg-white/10 rounded-full px-4 py-3 hover:bg-white/15 transition-colors backdrop-blur-sm flex-shrink-0"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowTokenSelector('to')}
              >
                <span className="text-2xl">{swapState.toToken.icon}</span>
                <span className="font-semibold text-white">{swapState.toToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-white/60" />
              </motion.button>
              
              <div className="flex-1 text-right text-2xl font-light text-white/70 min-w-0">
                {swapState.toAmount || '0.0'}
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-white/50">
                ${swapState.toToken.price.toLocaleString()}
              </span>
              <span className="text-xs text-white/50">
                ≈ ${(Number(swapState.toAmount || 0) * swapState.toToken.price).toFixed(2)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Swap Info */}
        {swapState.fromAmount && (
          <motion.div
            className="bg-white/5 rounded-xl p-4 mb-6 space-y-3 border border-white/10"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Rate</span>
              <span className="text-white">1 {swapState.fromToken.symbol} = {(swapState.toToken.price / swapState.fromToken.price).toFixed(6)} {swapState.toToken.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Slippage</span>
              <span className="text-white">{swapState.slippage}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Network Fee</span>
              <span className="text-white">~$2.50</span>
            </div>
          </motion.div>
        )}

        {/* Swap Button */}
        <motion.button
          className={cn(
            "w-full py-4 rounded-full font-medium text-lg transition-all duration-300 backdrop-blur-sm",
            swapState.status === 'success' 
              ? "bg-green-500 text-white"
              : swapState.status === 'error'
              ? "bg-red-500 text-white"
              : swapState.isLoading
              ? "bg-white/20 text-white cursor-not-allowed"
              : !swapState.fromAmount || Number(swapState.fromAmount) <= 0
              ? "bg-white/10 text-white/50 cursor-not-allowed"
              : "bg-white text-black hover:bg-white/90"
          )}
          whileHover={!swapState.isLoading && swapState.fromAmount ? { scale: 1.02 } : {}}
          whileTap={!swapState.isLoading && swapState.fromAmount ? { scale: 0.98 } : {}}
          disabled={swapState.isLoading || !swapState.fromAmount || Number(swapState.fromAmount) <= 0}
          onClick={handleSwap}
          variants={itemVariants}
        >
          <div className="flex items-center justify-center gap-2">
            {swapState.isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Swapping...
              </>
            ) : swapState.status === 'success' ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Swap Successful!
              </>
            ) : swapState.status === 'error' ? (
              <>
                <AlertCircle className="w-5 h-5" />
                Swap Failed
              </>
            ) : !swapState.fromAmount || Number(swapState.fromAmount) <= 0 ? (
              'Enter an amount'
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Swap Tokens
              </>
            )}
          </div>
        </motion.button>
      </motion.div>

      {/* Token Selector Modal */}
      <AnimatePresence>
        {showTokenSelector && (
          <motion.div
            className="absolute inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
            <motion.div
              ref={tokenSelectorRef}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl overflow-x-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <h3 className="text-lg font-serif font-semibold mb-6 text-white">Select Token</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pr-1 rounded-xl">
                {defaultTokens.map((token, index) => (
                  <motion.button
                    key={token.address}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/10 transition-colors min-w-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTokenSelect(token)}
                  >
                    <span className="text-2xl flex-shrink-0">{token.icon}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-semibold text-white truncate">{token.symbol}</div>
                      <div className="text-sm text-white/60 truncate">{token.name}</div>
                    </div>
                    <div className="text-right min-w-0">
                      <div className="font-semibold text-white truncate">{token.balance}</div>
                      <div className={cn(
                        "text-sm",
                        token.change24h >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
            <motion.div
              ref={settingsRef}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <h3 className="text-lg font-serif font-semibold mb-6 text-white">Swap Settings</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-sm text-white/60 mb-3 block">
                    Slippage Tolerance
                  </label>
                  <div className="flex gap-3">
                    {[0.1, 0.5, 1.0].map((value) => (
                      <motion.button
                        key={value}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                          swapState.slippage === value
                            ? "bg-white text-black"
                            : "bg-white/10 hover:bg-white/20 text-white"
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSwapState(prev => ({ ...prev, slippage: value }))}
                      >
                        {value}%
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CryptoSwapDemo() {
  return (
    <div className="flex w-full flex-col min-h-screen bg-black relative">
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-black"
          colors={[
            [255, 255, 255],
            [255, 255, 255],
          ]}
          dotSize={6}
          reverse={false}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.8)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>
      
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full flex flex-col items-center">
          <CryptoSwapBox />
          {/* Logo under swap component */}
          <a href="/" className="mt-8 block">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-48 max-w-xs h-auto object-contain transition-transform hover:scale-105"
              style={{ margin: '0 auto' }}
            />
          </a>
        </div>
      </div>
      
      {/* Logo positioned in bottom right */}
      <div className="fixed bottom-4 right-4 z-20">
        {/* Removed old fixed logo as per new placement */}
      </div>
    </div>
  );
}

export default CryptoSwapDemo;
