'use client';
import React from 'react';

interface SkillSelectorProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  isDarkMode: boolean;
}

export function SkillSelector({ selectedSkills, onChange, isDarkMode }: SkillSelectorProps) {
  const skills = ['React', 'TypeScript', 'Node.js', 'Supabase', 'Firebase', 'Tailwind CSS'];
  
  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      onChange(selectedSkills.filter(s => s !== skill));
    } else {
      onChange([...selectedSkills, skill]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map(skill => (
        <button
          key={skill}
          type="button"
          onClick={() => toggleSkill(skill)}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            selectedSkills.includes(skill)
              ? 'bg-blue-600 text-white'
              : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
          }`}
        >
          {skill}
        </button>
      ))}
    </div>
  );
}
