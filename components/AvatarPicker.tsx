
import React from 'react';
import { AVATARS } from '../constants';

interface AvatarPickerProps {
  selected: string;
  onSelect: (url: string) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {AVATARS.map((url) => (
        <button
          key={url}
          onClick={() => onSelect(url)}
          className={`relative rounded-full overflow-hidden border-4 transition-all ${
            selected === url ? 'border-blue-500 scale-110 shadow-lg' : 'border-transparent opacity-60'
          }`}
        >
          <img src={url} alt="Avatar" className="w-full h-full object-cover" />
          {selected === url && (
            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
              <i className="fas fa-check text-white"></i>
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
