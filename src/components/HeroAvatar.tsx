import { useState } from 'react';
import { Shield } from 'lucide-react';
import { HeroDefinition } from '../game/types';

interface HeroAvatarProps {
  hero: HeroDefinition;
  className?: string;
  imgClassName?: string;
}

export function HeroAvatar({ hero, className = '', imgClassName = '' }: HeroAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#162033] text-slate-200 select-none ${className}`}
        style={{
          backgroundImage: `radial-gradient(circle at 30% 25%, ${hero.accentColor}33, #0f172a 75%)`,
        }}
      >
        <Shield className="w-7 h-7 mb-1 opacity-80" style={{ color: hero.accentColor }} />
        <span className="font-display text-xs font-bold tracking-wide">{hero.name}</span>
      </div>
    );
  }

  return (
    <img
      src={hero.portraitUrl}
      alt={`Potret hero ${hero.name} (${hero.role})`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover object-top ${imgClassName} ${className}`}
    />
  );
}
