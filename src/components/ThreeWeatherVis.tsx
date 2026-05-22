/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { DashboardWidget } from '../services/orchestrator';

interface ThreeWeatherVisProps {
  widget: DashboardWidget;
}

const Bar = ({ position, height, color, label, value }: { position: [number, number, number], height: number, color: string, label: string, value: string }) => {
  const mesh = useRef<THREE.Mesh>(null);
  
  // Animate the bars growing
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.scale.y = THREE.MathUtils.lerp(mesh.current.scale.y, 1, 0.1);
    }
  });

  return (
    <group position={position}>
      <mesh ref={mesh} position={[0, height / 2, 0]} scale={[1, 0, 1]}>
        <boxGeometry args={[0.8, height, 0.8]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
      </mesh>
      {/* Label below */}
      <Text
        position={[0, -0.5, 0.5]}
        fontSize={0.3}
        color="#a1a1aa"
        anchorX="center"
        anchorY="top"
        rotation={[-Math.PI / 4, 0, 0]}
      >
        {label}
      </Text>
      {/* Value above */}
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <Text
          position={[0, height + 0.5, 0]}
          fontSize={0.4}
          color="#fff"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000"
        >
          {value}
        </Text>
      </Float>
    </group>
  );
};

const Scene = ({ widget }: { widget: DashboardWidget }) => {
  const data = widget.customData || [];
  const xAxisKey = widget.xAxisKey || 'date';
  // Use first data key for visualization if available
  const dataKey = widget.dataKeys?.[0] || 'temperature_2m';
  
  const processedData = useMemo(() => {
    // Limit to top 24 items for a cleaner "panoramic" view (e.g. 24 hours or many days)
    const sliced = data.slice(0, 24);
    const maxVal = Math.max(...sliced.map((d: any) => Number(d[dataKey]) || 0), 1);
    const isHarmony = dataKey.includes('harmony');
    
    return sliced.map((item: any, index: number) => {
      const val = Number(item[dataKey]) || 0;
      const height = Math.max((val / maxVal) * 8, 0.1); 
      
      // color logic
      let color;
      if (isHarmony) {
        // Harmony scale: Purple/Fuchsia to Cyan
        const t = Math.min(Math.max(val / 100, 0), 1);
        color = new THREE.Color().setHSL(0.8 - t * 0.3, 0.9, 0.6);
      } else {
        // Temperature scale: Blue to Red
        const t = Math.min(Math.max((val + 10) / 50, 0), 1); // -10 to 40 range
        color = new THREE.Color().setHSL(0.6 - t * 0.6, 0.8, 0.6);
      }
      
      let label = item[xAxisKey];
      if (typeof label === 'string' && label.includes('T')) {
          const date = new Date(label);
          label = `${date.getHours()}h`;
      } else if (typeof label === 'string' && label.includes('-')) {
          const date = new Date(label);
          label = `${date.getDate()}/${date.getMonth() + 1}`;
      }

      return {
        position: [(index - sliced.length / 2) * 1.8, 0, 0] as [number, number, number],
        height,
        color: color.getStyle(),
        label: String(label),
        value: val.toFixed(0)
      };
    });
  }, [data, dataKey, xAxisKey]);

  return (
    <>
      <ambientLight intensity={0.2} />
      <spotLight position={[10, 20, 10]} angle={0.15} penumbra={1} intensity={2} color="#38bdf8" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#f43f5e" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <group position={[0, -2, 0]}>
        {processedData.map((d, i) => (
          <Bar key={i} {...d} />
        ))}
        <gridHelper args={[100, 50, '#ffffff05', '#ffffff05']} position={[0, -0.1, 0]} />
      </group>
      
      <OrbitControls 
        enablePan={false} 
        enableZoom={false} 
        autoRotate 
        autoRotateSpeed={0.5}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
};

export const ThreeWeatherVis: React.FC<ThreeWeatherVisProps> = ({ widget }) => {
  return (
    <div className="bg-white/5 backdrop-blur-[40px] rounded-[32px] border border-white/10 shadow-2xl h-full overflow-hidden flex flex-col group">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-3 bg-fuchsia-400 rounded-full" />
          <h3 className="text-[14px] font-bold uppercase tracking-widest text-white/90">
            {widget.title}
          </h3>
        </div>
        {widget.description && (
          <p className="text-[12px] text-white/40 leading-relaxed font-medium">
            {widget.description}
          </p>
        )}
      </div>
      <div className="flex-1 min-h-[300px] w-full relative">
        <Canvas camera={{ position: [0, 8, 18], fov: 45 }}>
          <fog attach="fog" args={['#0c4a6e', 10, 50]} />
          <Scene widget={widget} />
        </Canvas>
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white/40 text-[10px] font-bold uppercase tracking-widest border border-white/5">
            Inter-Space Render
          </div>
        </div>
      </div>
    </div>
  );
};
