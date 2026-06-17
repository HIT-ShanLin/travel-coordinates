import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Place } from "../lib/types";

type GlobeProps = {
  places: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
};

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function Marker({
  place,
  selected,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVector3(place.latitude, place.longitude, 1.05), [place.latitude, place.longitude]);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.scale.setScalar(selected ? 1.15 + Math.sin(clock.elapsedTime * 5) * 0.03 : 1);
    }
  });

  return (
    <mesh ref={ref} position={position} onClick={onSelect}>
      <sphereGeometry args={[0.03, 16, 16]} />
      <meshStandardMaterial color={selected ? "#ffd166" : "#7dd3fc"} emissive={selected ? "#d97706" : "#0f172a"} />
    </mesh>
  );
}

function GlobeMesh({ places, selectedPlaceId, onSelectPlace }: GlobeProps) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = clock.elapsedTime * 0.08;
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#153a63" roughness={0.95} metalness={0.05} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.01, 64, 64]} />
        <meshBasicMaterial color="#7cc6ff" wireframe transparent opacity={0.12} />
      </mesh>
      {places.map((place) => (
        <Marker
          key={place.id}
          place={place}
          selected={place.id === selectedPlaceId}
          onSelect={() => onSelectPlace(place.id)}
        />
      ))}
    </group>
  );
}

export function Globe(props: GlobeProps) {
  return (
    <div className="globe-frame">
      <Canvas camera={{ position: [0, 0, 3.2], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 2, 3]} intensity={2.4} />
        <GlobeMesh {...props} />
        <OrbitControls enablePan={false} minDistance={2.2} maxDistance={5} />
      </Canvas>
      <div className="globe-hint">拖拽旋转，滚轮缩放，点击标记查看地点</div>
    </div>
  );
}
